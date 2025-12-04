# Upload Architecture

## Overview

The upload system uses a **2-phase upload flow** with the API as orchestrator and an **Outbox pattern** for reliable queue processing.

```
Extension → Worker → API (init) → Worker (R2 store) → API (finalize) → Queue → Worker (parse)
```

## 2-Phase Upload Flow

### Phase 1: Initialize
```
Extension → POST :8787/upload
Worker → POST /worker/uploads/init
```

1. Extension sends file to Cloudflare Worker
2. Worker validates request (auth, size, content type)
3. Worker extracts text from PDF/DOCX
4. Worker calls API `/init` to create pending upload record
5. API returns `fileId`, `objectKey`, `processId`

### Phase 2: Finalize
```
Worker → R2 (store file)
Worker → POST /worker/uploads/finalize
API → Queue (send message)
```

1. Worker stores file in R2 using `objectKey`
2. Worker computes file hash (SHA-256)
3. Worker calls API `/finalize` with `fileId`, `processId`, `size`, `rawText`, `fileHash`
4. API checks for duplicates (same hash = deduplicated)
5. API atomically: updates upload record + creates outbox entry + triggers queue

## Outbox Pattern (Event-Sourcing)

The Outbox uses an **event-sourcing pattern** for reliable queue message delivery:

- **Append-only**: Each status change creates a new document (no in-place updates)
- **Immutable fields**: `processId`, `type`, `uploadId`, `fileId`, `userId`, `fileType` cannot be modified
- **Latest status**: Determined by querying the most recent entry per `processId`
- **Full audit trail**: All state transitions are preserved as separate documents

### Status Transitions

Each arrow represents a **new document** being created:

```
pending → sending → processing → completed
                              ↘ failed
```

| Status | Description |
|--------|-------------|
| `pending` | Entry created, waiting to be sent to queue |
| `sending` | Locked for sending (prevents duplicate sends) |
| `processing` | Message sent to queue, worker is processing |
| `completed` | Successfully parsed and stored |
| `failed` | Processing failed after retries |

### Event-Sourcing Flow

```typescript
// 1. Find pending entry and create new "sending" entry
const sendingEntry = await OutboxModel.markAsSending(processId);

// 2. Send to Cloudflare Queue
await sendToCloudflareQueue(message);

// 3. Create new "processing" entry
await OutboxModel.markAsProcessing(sendingEntry);
```

All status changes use static model methods that create new documents rather than mutating existing ones.

### Retry Mechanism

The `outboxProcessor` worker runs periodically to:
1. Find entries stuck in `pending` state (failed initial send)
2. Find entries stuck in `sending` state (send succeeded but status update failed)
3. Retry sending them to the queue

**File:** `apps/api/src/workers/outboxProcessor.ts`

### Idempotency

Cloudflare Queues provide at-least-once delivery. The API handles duplicates:
- If outbox entry is already `completed` or `failed`, return success with `duplicate: true`
- Worker can safely retry without reprocessing

## Request Format

```
POST /upload
Headers:
  Content-Type: application/pdf | application/vnd.openxmlformats-officedocument.wordprocessingml.document
  X-Upload-Filename: resume.pdf
  X-User-Id: <supabase-user-id>
  X-User-Email: user@example.com
  X-Extension-Key: <EXTENSION_SECRET>
  Origin: chrome-extension://<extension-id>  (required in prod)
Body: file binary (max 5MB)
```

## Canonical Upload System

Each `fileHash` has exactly **one canonical upload attempt**. The `isCanonical` field identifies the authoritative record.

### Goals

- Prevent duplicate processing
- Allow retries after failed or deleted attempts
- Guarantee race-safe, single canonical per hash

### Canonical Resolution Rules

When a new upload arrives with a `fileHash`:

1. **No canonical exists** → New upload becomes canonical (`isCanonical = true`)
2. **Canonical exists with blocking status** → Deduplicate the new upload
3. **Canonical exists with replaceable status** → Replace canonical ownership

| Status | Category | Action |
|--------|----------|--------|
| `pending` | Blocking | Deduplicate (upload in progress) |
| `uploaded` | Blocking | Deduplicate (completed upload exists) |
| `failed` | Replaceable | Replace canonical |
| `rejected` | Replaceable | Replace canonical |
| `deleted-by-user` | Replaceable | Replace canonical |

**Note:** `deduplicated` uploads cannot be canonical (enforced by schema validator).

### Atomic Canonical Resolution

Canonical resolution happens **inside a MongoDB transaction** to prevent race conditions:

1. Start transaction with snapshot isolation
2. Query for existing canonical within transaction
3. If replacing: atomically revoke old canonical's status
4. Set new upload's `isCanonical = true`
5. Commit transaction

This ensures no two concurrent requests can both claim canonical status for the same `fileHash`.

### Worker Guard

Workers must only process canonical uploads:
- `GET /worker/uploads/:uploadId/raw-text` returns `409 Conflict` for non-canonical uploads
- Worker stops processing immediately on 409

### Parse Pipeline Independence

Parse statuses (`pending`, `sending`, `processing`, `completed`, `failed`) do **not** affect canonical ownership:
- A parse failure never requires a new upload
- Retry parsing on the canonical record instead

### Database Index

A partial unique index enforces single canonical per hash:
```javascript
{ fileHash: 1 }, { unique: true, partialFilterExpression: { isCanonical: true } }
```

### Files

- **Canonical Logic:** `apps/api/src/uploads/fileUpload.statics.ts`
- **Tests:** `apps/api/src/uploads/canonical.test.ts`

## Deduplication

Files are deduplicated per-user using SHA-256 hash:
1. Worker computes hash before storing in R2
2. API resolves canonical status via `FileUploadModel.resolveAndClaimCanonical()`
3. If canonical exists with blocking status: mark new upload as `deduplicated`, return existing file info
4. If canonical exists with replaceable status: transfer canonical ownership to new upload
5. Worker deletes the duplicate from R2 (for deduplicated uploads)

## Error Handling

| Error | Status | Action |
|-------|--------|--------|
| Invalid auth | 403 | Reject immediately |
| File too large | 413 | Reject before API call |
| Text extraction failed | 400 | Reject, no DB record |
| Init failed | 500 | Reject, no cleanup needed |
| Finalize failed | 500 | Delete R2 object, return error |
| Queue send failed | - | Outbox worker will retry |

## Files

- **Worker:** `apps/upload-queue-consumer/src/lib/uploadHandler.ts`
- **API Init:** `apps/api/src/routes/uploads/initUpload.controller.ts`
- **API Finalize:** `apps/api/src/routes/uploads/finalizeUpload.controller.ts`
- **Queue Producer:** `apps/api/src/workers/queue/producer.ts`
- **Outbox Processor:** `apps/api/src/workers/outboxProcessor.ts`
- **Outbox Model:** `apps/api/src/outbox/outbox.model.ts`

## Config

- Worker: `apps/upload-queue-consumer/.dev.vars` (`EXTENSION_SECRET`, `WORKER_SECRET`, `API_URL`)
- Extension: `VITE_UPLOAD_URL`, `VITE_EXTENSION_SECRET` (background script only)
