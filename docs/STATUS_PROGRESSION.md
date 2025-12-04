# Status Progression

This document explains the status progression through the upload and parsing pipeline.

## Overview

A file upload goes through two independent status tracks:

1. **Upload Status** (`FileUploadStatus`) - Tracks the upload lifecycle
2. **Parse Status** (`ParseStatus`) - Tracks the parsing/processing lifecycle via Outbox

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              UPLOAD PIPELINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Extension → Worker → API                                                   │
│                                                                             │
│  ┌─────────┐    ┌──────────┐    ┌────────────┐                             │
│  │ pending │───▶│ uploaded │───▶│ Parse      │                             │
│  └─────────┘    └──────────┘    │ Pipeline   │                             │
│       │              │          └────────────┘                             │
│       │              │                                                      │
│       ▼              ▼                                                      │
│  ┌─────────┐    ┌─────────────┐                                            │
│  │ failed  │    │ deduplicated│ (points to canonical)                      │
│  └─────────┘    └─────────────┘                                            │
│       │                                                                     │
│       ▼                                                                     │
│  ┌──────────┐   ┌─────────────────┐                                        │
│  │ rejected │   │ deleted-by-user │                                        │
│  └──────────┘   └─────────────────┘                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              PARSE PIPELINE (Outbox)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  API → Queue → Worker → API                                                 │
│                                                                             │
│  ┌─────────┐    ┌─────────┐    ┌────────────┐    ┌───────────┐             │
│  │ pending │───▶│ sending │───▶│ processing │───▶│ completed │             │
│  └─────────┘    └─────────┘    └────────────┘    └───────────┘             │
│                                       │                                     │
│                                       ▼                                     │
│                                  ┌─────────┐                                │
│                                  │ failed  │                                │
│                                  └─────────┘                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Upload Status (`FileUploadStatus`)

Defined in `packages/types/src/index.ts`.

| Status | Description | Terminal? | Canonical? |
|--------|-------------|-----------|------------|
| `pending` | Upload initialized, waiting for file storage | No | Yes (blocking) |
| `uploaded` | File stored in R2, ready for parsing | No | Yes (blocking) |
| `failed` | Upload failed (e.g., storage error) | Yes | Yes (replaceable) |
| `rejected` | File rejected (e.g., invalid content) | Yes | Yes (replaceable) |
| `deduplicated` | Duplicate of existing canonical upload | Yes | **No** (never) |
| `deleted-by-user` | User deleted the upload | Yes | Yes (replaceable) |

### Status Transitions

```
pending ──────────▶ uploaded ──────────▶ (parse pipeline)
    │                   │
    │                   ▼
    │              deduplicated (if duplicate hash found)
    │
    ▼
  failed ──────────▶ rejected (if content invalid)
```

### Canonical Categories

**Blocking statuses** - New uploads with same hash are deduplicated:
- `pending` - Upload in progress
- `uploaded` - Completed upload exists

**Replaceable statuses** - New uploads can take over canonical ownership:
- `failed` - Previous attempt failed
- `rejected` - Previous attempt was rejected
- `deleted-by-user` - User deleted previous upload

**Never canonical:**
- `deduplicated` - Always points to another canonical upload (enforced by schema validator)

## Parse Status (`ParseStatus`)

Defined in `packages/types/src/index.ts`. Tracked via the **Outbox pattern** (event-sourcing).

| Status | Description | Terminal? |
|--------|-------------|-----------|
| `pending` | Outbox entry created, waiting to send to queue | No |
| `sending` | Locked for sending (prevents duplicate sends) | No |
| `processing` | Message sent to queue, worker is processing | No |
| `completed` | Successfully parsed, CV data stored | Yes |
| `failed` | Processing failed after retries | Yes |

### Status Transitions

```
pending ──▶ sending ──▶ processing ──▶ completed
                              │
                              ▼
                           failed
```

### Event-Sourcing Model

Each status change creates a **new document** (append-only):

```typescript
// Entry 1: { processId: "abc", status: "pending", ... }
// Entry 2: { processId: "abc", status: "sending", ... }
// Entry 3: { processId: "abc", status: "processing", ... }
// Entry 4: { processId: "abc", status: "completed", ... }
```

Latest status is determined by querying the most recent entry per `processId`.

## Combined Pipeline Flow

```
1. Extension sends file to Worker
   └─▶ Upload: (none)
   └─▶ Parse: (none)

2. Worker calls API /init
   └─▶ Upload: pending
   └─▶ Parse: (none)

3. Worker stores file in R2, calls API /finalize
   └─▶ Upload: uploaded (or deduplicated)
   └─▶ Parse: pending (outbox entry created)

4. API sends to Cloudflare Queue
   └─▶ Upload: uploaded
   └─▶ Parse: sending → processing

5. Worker parses CV, calls API /outbox/status
   └─▶ Upload: uploaded
   └─▶ Parse: completed (or failed)
```

## Independence of Status Tracks

**Parse failures do NOT affect upload status:**
- If parsing fails, the upload remains `uploaded`
- Retry parsing on the same canonical record
- No need to re-upload the file

**Upload status does NOT affect parse status:**
- A `deleted-by-user` upload may still have `completed` parse status
- Parse data (CVData) is preserved even if upload is deleted

## API Response: Combined Status

The `GET /uploads` endpoint returns both statuses:

```typescript
{
  fileId: "abc-123",
  status: "uploaded",        // Upload status
  parseStatus: "completed",  // Parse status (from latest outbox entry)
  // ...
}
```

## Files

- **Upload Status:** `packages/types/src/index.ts` (`FILE_UPLOAD_STATUSES`)
- **Parse Status:** `packages/types/src/index.ts` (`PARSE_STATUSES`)
- **Canonical Logic:** `apps/api/src/uploads/fileUpload.statics.ts`
- **Outbox Model:** `apps/api/src/outbox/outbox.model.ts`
