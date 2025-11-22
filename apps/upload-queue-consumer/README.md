# Upload Queue Consumer

Cloudflare Worker that consumes messages from the `parse-cv` queue and processes uploaded CV files.

## Quick Start

### Local Development

```bash
cd apps/upload-queue-consumer
pnpm install
pnpm dev
```

### Production Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for complete CI/CD setup instructions.

**Option 1: Quick deploy (direct wrangler)**
```bash
export CLOUDFLARE_API_TOKEN="your-token"
pnpm deploy
```

**Option 2: Using deploy script (with checks)**
```bash
export CLOUDFLARE_API_TOKEN="your-token"
./deploy.sh
```
> 📝 **Note:** `deploy.sh` includes pre-deployment checks and is useful for manual deploys or non-GitHub CI/CD systems. If you only use GitHub Actions, you can delete this file.

## Configuration

### 1. Configure Wrangler

Update `wrangler.toml`:
- Queue name (should match your Cloudflare Queue)
- R2 bucket name
- Dead letter queue name

### 2. Configuration Variables

Set in `wrangler.toml`:
- `API_URL` - Your API server endpoint
- `ENVIRONMENT` - `prod` or `dev`

No secrets needed! The worker calls your API, which handles MongoDB access.

### 3. Connect Queue to Consumer

In Cloudflare Dashboard:
1. **Queues** → `parse-cv` → **Settings** → **Consumers**
2. Click **Add Consumer**
3. Select worker: `upload-queue-consumer`
4. Configure:
   - Batch size: **10**
   - Max wait time: **5 seconds**
   - Max retries: **3**
   - Dead Letter Queue: `parse-cv-dlq`

## Commands

```bash
pnpm dev      # Local development
pnpm deploy   # Deploy to Cloudflare
pnpm tail     # View live logs
pnpm types    # Generate TypeScript types
```

## How It Works

1. **Queue receives message**: Producer (API) sends a message with `{ fileId, logId, userId }`
2. **Worker processes batch**: Worker receives batches of messages (up to `max_batch_size`)
3. **Download file**: Downloads CV file from R2 bucket
4. **Parse CV**: Processes the CV (TODO: implement actual parsing logic)
5. **Update status**: Calls API to update outbox entry status
6. **Handle errors**: Failed messages are retried based on configuration

## Message Structure

```typescript
interface ParseCVQueueMessage {
  fileId: string;   // R2 object key
  logId: string;    // Outbox entry ID
  userId: string;   // User who uploaded the file
}
```

## Production Deployment

For CI/CD setup, environment management, and production best practices, see:

👉 **[DEPLOYMENT.md](./DEPLOYMENT.md)**

Includes:
- GitHub Actions workflow
- Environment variables setup
- Secret management
- Multiple CI/CD platform examples
- Monitoring and rollback procedures

## TODO

- [ ] Implement actual CV parsing logic (convert PDF/DOCX to text, extract structured data)
- [ ] Add integration with AI service for parsing (OpenAI, Anthropic, etc.)
- [ ] Add monitoring and alerting
- [x] Create API endpoint for updating outbox status
- [ ] Set up dead letter queue handling
