# Queue Consumer Setup Guide

Complete guide for setting up the Cloudflare Queue consumer for processing CV files.

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

**Flow:**
1. **API** receives file upload and creates outbox entry
2. **Outbox Processor** (background job in API) sends message to Cloudflare Queue
3. **Cloudflare Queue** batches messages and delivers to consumer
4. **Worker** downloads file from R2, parses it, and updates outbox via API
5. **API** updates outbox entry status in MongoDB

## Prerequisites

- Cloudflare account with Workers enabled
- R2 bucket created
- API server with `/api/outbox/:processId` endpoint

## Production Setup

### 1. Create Cloudflare Queues

```bash
# Main queue
wrangler queues create parse-cv

# Dead letter queue (recommended)
wrangler queues create parse-cv-dlq
```

### 2. Create R2 Bucket

```bash
wrangler r2 bucket create lazy-job-uploads-prod
```

### 3. Configure wrangler.toml

Update `API_URL` in `wrangler.toml`:

```toml
[vars]
ENVIRONMENT = "prod"
API_URL = "https://api.yourapp.com"  # Your production API
```

### 4. Deploy Worker

```bash
cd apps/upload-queue-consumer
wrangler deploy
```

### 5. Connect Queue to Consumer

In Cloudflare Dashboard:

1. Go to **Queues** → `parse-cv`
2. Click **Settings** → **Consumers**
3. Click **Add Consumer**
4. Select worker: `upload-queue-consumer`
5. Configure:
   - **Batch size**: 10
   - **Max wait time**: 5 seconds
   - **Max retries**: 3
   - **Dead Letter Queue**: `parse-cv-dlq`
6. Click **Add**

## Dev Environment Setup

### 1. Create Dev Queues

```bash
# Dev queues (separate from production)
wrangler queues create parse-cv-dev
wrangler queues create parse-cv-dlq-dev
```

### 2. Create Dev R2 Bucket

```bash
wrangler r2 bucket create lazy-job-uploads-dev
```

### 3. Configure Dev Environment

Update `wrangler.toml`:

```toml
[env.dev.vars]
ENVIRONMENT = "dev"
API_URL = "http://localhost:5050"  # Or your dev API URL
```

### 4. Deploy to Dev

```bash
wrangler deploy --env dev
```

### 5. Connect Dev Queue

Same as production, but use:
- Queue: `parse-cv-dev`
- Worker: `upload-queue-consumer-dev`
- DLQ: `parse-cv-dlq-dev`

## Local Development

### 1. Configure Local Environment

Create `.dev.vars`:

```bash
API_URL=http://localhost:5050
```

### 2. Start API Server

```bash
cd apps/api
pnpm dev  # Runs on localhost:5050
```

### 3. Start Worker

In another terminal:

```bash
cd apps/upload-queue-consumer
pnpm dev  # Runs on localhost:8787
```

### 4. Test Locally

```bash
# Send test message
curl -X POST http://localhost:8787/ \
  -H "Content-Type: application/json" \
  -d '{
    "fileId": "test-file-123",
    "processId": "507f1f77bcf86cd799439011",
    "userId": "user-123"
  }'
```

## Queue Configuration

### Consumer Settings

Configure in Cloudflare Dashboard → Queues → Settings → Consumers:

| Setting | Recommended | Description |
|---------|-------------|-------------|
| **Batch size** | 10 | Messages per batch (1-100) |
| **Max wait time** | 5 seconds | Wait before delivering partial batch |
| **Max retries** | 3 | Retry attempts before DLQ |
| **Retry delay** | 0 seconds | Let Cloudflare handle backoff |
| **Max concurrency** | auto | Auto-scale workers |

### Why These Settings?

- **Batch size 10**: Balances efficiency and processing time
- **5 second wait**: Quick response without too many invocations
- **3 retries**: Handles transient failures without excessive retries
- **Auto concurrency**: Scales automatically with load

## Testing

### Send Test Message to Queue

```bash
# Production
wrangler queues producer parse-cv send '{"fileId":"test","processId":"test","userId":"test"}'

# Dev
wrangler queues producer parse-cv-dev send '{"fileId":"test","processId":"test","userId":"test"}'
```

### Monitor Queue

In Cloudflare Dashboard:
- **Queues** → `parse-cv` → **Metrics**: Message throughput
- **Queues** → `parse-cv` → **Messages**: Pending/processing messages

### View Worker Logs

```bash
# Production
wrangler tail

# Dev
wrangler tail --env dev

# Filter errors only
wrangler tail --status error
```

### Check API Logs

Your API should log:
- `"Updating outbox status"` - When worker calls endpoint
- `"Outbox entry marked as completed"` - Success
- `"Outbox entry marked as failed"` - Failure

## Troubleshooting

### Messages Not Being Consumed

1. **Verify worker is deployed:**
   ```bash
   wrangler deployments list
   ```

2. **Check consumer is connected:**
   - Dashboard → Queues → parse-cv → Settings → Consumers
   - Should show your worker

3. **Check worker logs:**
   ```bash
   wrangler tail
   ```

### Messages Going to DLQ

1. Check worker logs for errors
2. Verify API endpoint is accessible
3. Check R2 bucket access
4. Review DLQ messages for error details

### Worker Can't Reach API

- Verify `API_URL` in `wrangler.toml`
- Ensure API server is running
- Check API endpoint exists: `PATCH /api/outbox/:processId`

### R2 Access Issues

- Verify R2 bucket name in `wrangler.toml`
- Check bucket exists: `wrangler r2 bucket list`
- Ensure files are in correct path: `cv/{fileId}`

## API Endpoint Requirements

Your API must have this endpoint:

```typescript
PATCH /api/outbox/:processId

Request Body:
{
  status: "completed" | "failed",
  data: ParsedCVData | null,
  error?: string
}

Response:
{
  success: true,
  processId: string,
  status: string
}
```

## Environment Comparison

| Feature | Local | Dev | Production |
|---------|-------|-----|------------|
| **Queue** | N/A (direct call) | `parse-cv-dev` | `parse-cv` |
| **DLQ** | N/A | `parse-cv-dlq-dev` | `parse-cv-dlq` |
| **R2 Bucket** | `dev` | `dev` | `prod` |
| **API URL** | `localhost:5050` | Dev API URL | Prod API URL |
| **Worker** | `localhost:8787` | `upload-queue-consumer-dev` | `upload-queue-consumer` |

## Next Steps

1. **Implement CV Parsing**
   - Add PDF/DOCX parsing in `parseCV()` function
   - Extract structured data (name, email, skills, etc.)
   - Consider AI services (OpenAI, Anthropic)

2. **Add Monitoring**
   - Set up alerts for DLQ messages
   - Track processing times
   - Monitor success/failure rates

3. **Optimize Performance**
   - Adjust batch size based on metrics
   - Add caching if needed
   - Consider parallel processing

4. **Add Tests**
   - Unit tests for parsing logic
   - Integration tests with queue
   - E2E tests for full flow

## Resources

- [Cloudflare Queues Documentation](https://developers.cloudflare.com/queues/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [R2 Documentation](https://developers.cloudflare.com/r2/)
