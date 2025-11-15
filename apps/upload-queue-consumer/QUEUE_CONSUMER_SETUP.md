# Cloudflare Queue Consumer Setup Guide

This guide explains how to set up the Cloudflare Queue consumer for processing CV files.

## Architecture

```
┌─────────┐      ┌──────────┐      ┌──────────────┐      ┌────────┐
│  API    │ ───> │ Outbox   │ ───> │  Cloudflare  │ ───> │ Worker │
│         │      │          │      │    Queue     │      │        │
└─────────┘      └──────────┘      └──────────────┘      └────────┘
                                                               │
                                                               v
                                                          ┌────────┐
                                                          │   R2   │
                                                          └────────┘
                                                               │
                                                               v
                                                          ┌────────┐
                                                          │  API   │
                                                          └────────┘
```

1. **API** receives file upload and creates outbox entry
2. **Outbox Processor** (background job in API) sends message to Cloudflare Queue
3. **Cloudflare Queue** batches messages and delivers to consumer
4. **Worker** (Consumer) downloads file from R2, parses it, and updates outbox via API
5. **API** updates outbox entry status

## Setup Steps

### 1. Create the Queue in Cloudflare

In Cloudflare Dashboard:
1. Go to **Queues**
2. Click **Create Queue**
3. Name: `parse-cv`
4. Click **Create**

### 2. Create Dead Letter Queue (Optional but Recommended)

1. Create another queue named `parse-cv-dlq`
2. This will store messages that failed after max retries

### 3. Install Worker Dependencies

```bash
cd apps/worker
pnpm install
```

### 4. Configure Environment Variables

#### For the Worker (Cloudflare)

Set secrets using wrangler CLI:

```bash
cd apps/worker

# Your API URL (where worker will send status updates)
wrangler secret put API_URL
# Example: https://api.yourapp.com

# MongoDB connection (if needed for direct DB access)
wrangler secret put MONGO_CONNECTION
# Example: mongodb+srv://user:pass@cluster.mongodb.net/dbname
```

#### For the API (Already configured)

Make sure these are in your `.env`:

```env
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_QUEUE_ID=parse-cv_queue_id
CLOUDFLARE_QUEUE_TOKEN=your_queue_token
```

### 5. Update wrangler.toml

Edit `apps/worker/wrangler.toml`:

```toml
name = "parse-cv-consumer"
main = "src/index.ts"
compatibility_date = "2025-01-13"

[[queues.consumers]]
queue = "parse-cv"
max_batch_size = 10
max_batch_timeout = 5
max_retries = 3
dead_letter_queue = "parse-cv-dlq"  # Optional

# R2 Bucket binding
[[r2_buckets]]
binding = "BUCKET"
bucket_name = "your-bucket-name"  # Change this to your R2 bucket name
```

### 6. Deploy the Worker

```bash
cd apps/worker
pnpm deploy
```

### 7. Connect Queue to Consumer (Cloudflare Dashboard)

Based on your screenshots:

1. Go to **Queues** → `parse-cv`
2. Click **Settings** → **Consumers**
3. Click **Add** consumer
4. **Type**: Worker
5. **Worker**: Select `parse-cv-consumer` from dropdown
6. Configure settings:
   - **Batch size**: 10
   - **Max wait time**: 5 seconds
   - **Max retries**: 3
   - **Retry delay**: 0 seconds
   - **Max consumer concurrency**: auto (recommended)
   - **Dead Letter Queue**: `parse-cv-dlq` (if you created it)
7. Click **Add**

## Testing

### 1. Upload a File

Use your API to upload a file:

```bash
curl -X POST https://api.yourapp.com/api/uploads/sign \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "resume.pdf",
    "contentType": "application/pdf"
  }'
```

### 2. Monitor Queue

In Cloudflare Dashboard:
- Go to **Queues** → `parse-cv`
- Check **Metrics** tab for message throughput
- Check **Messages** tab to see pending/processing messages

### 3. View Worker Logs

```bash
cd apps/worker
pnpm tail
```

Or in Cloudflare Dashboard:
- Go to **Workers & Pages** → `parse-cv-consumer`
- Click **Logs** tab

### 4. Check API Logs

The API will log outbox status updates:

```bash
cd apps/api
pnpm dev
```

Look for logs like:
- `"Outbox entry marked as completed"`
- `"Outbox entry marked as failed"`

## Configuration Options

### Queue Consumer Settings (in Cloudflare Dashboard)

- **Batch size**: Number of messages delivered in a single batch (1-100)
  - Higher = more efficient but longer processing time
  - Lower = faster response but more invocations
  - Recommended: 10

- **Max wait time**: Seconds to wait before delivering a batch (1-60)
  - How long to wait for batch to fill up
  - Recommended: 5

- **Max retries**: Number of retry attempts for failed messages (0-100)
  - After max retries, message goes to DLQ (if configured)
  - Recommended: 3

- **Retry delay**: Seconds to wait between retries (0-86400)
  - Exponential backoff is automatic
  - Recommended: 0 (let Cloudflare handle backoff)

- **Max consumer concurrency**: How many instances can run simultaneously
  - `auto`: Cloudflare scales automatically (recommended)
  - Or set a specific number (1-100)

## Troubleshooting

### Messages not being consumed

1. **Check worker is deployed**:
   ```bash
   wrangler deployments list
   ```

2. **Check consumer is connected**:
   - Cloudflare Dashboard → Queues → parse-cv → Settings → Consumers
   - Should show your worker

3. **Check worker logs**:
   ```bash
   wrangler tail
   ```

### Messages going to DLQ

1. **Check worker logs** for errors
2. **Check API endpoint** is accessible from worker
3. **Verify R2 bucket access** and file exists
4. **Review error messages** in DLQ messages

### TypeScript Errors

The worker TypeScript errors will resolve once you run:
```bash
cd apps/worker
pnpm install
```

This installs `@cloudflare/workers-types` which provides type definitions for:
- `R2Bucket`
- `MessageBatch`
- `ExecutionContext`
- `Message`
- `console`
- `fetch`

## Next Steps

1. **Implement CV Parsing Logic**
   - Currently just a placeholder in `apps/worker/src/index.ts`
   - Add PDF/DOCX parsing
   - Add structured data extraction
   - Consider using AI services (OpenAI, Anthropic)

2. **Add Monitoring**
   - Set up alerts for DLQ messages
   - Track processing times
   - Monitor success/failure rates

3. **Optimize Performance**
   - Adjust batch size based on processing time
   - Add caching if needed
   - Consider parallel processing within batches

4. **Add Tests**
   - Unit tests for parsing logic
   - Integration tests with queue
   - E2E tests for full flow

## API Endpoint

The worker calls this endpoint to update status:

```
PATCH /api/outbox/:logId
```

**Request Body**:
```json
{
  "status": "completed" | "failed",
  "data": { /* parsed CV data */ },
  "error": "error message (if failed)"
}
```

**Response**:
```json
{
  "success": true,
  "logId": "abc123",
  "status": "completed"
}
```

## Architecture Decisions

### Why Cloudflare Queues?

- **Scalability**: Auto-scales with demand
- **Reliability**: Built-in retries and DLQ
- **Cost**: Pay per operation, no idle costs
- **Integration**: Works seamlessly with R2 and Workers
- **Performance**: Low latency, global edge network

### Why Outbox Pattern?

- **Reliability**: Ensures no messages are lost
- **Atomicity**: DB write and queue send are separate
- **Monitoring**: Easy to track processing status
- **Recovery**: Can retry from outbox if queue fails

## Resources

- [Cloudflare Queues Documentation](https://developers.cloudflare.com/queues/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
