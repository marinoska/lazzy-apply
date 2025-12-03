# Upload Queue Consumer

Cloudflare Worker that processes CV files from the `parse-cv` queue using GPT-4o-mini.

## Architecture

```
Extension → Edge Worker → R2 + API → Queue → This Worker → OpenAI → API
                              ↓
                         file_upload (rawText stored)
```

**Flow:**
1. Edge Worker extracts raw text from PDF/DOCX at upload time (max 5MB file, 80KB text)
2. API stores `rawText` in `file_upload` document and queues message
3. This worker fetches `rawText` from API and sends to LLM
4. Parsed CV data is saved via API outbox update

## Quick Start

```bash
# Local development
pnpm dev

# Deploy
export CLOUDFLARE_API_TOKEN="your-token"
pnpm deploy
```

## Configuration

### Environment Variables

**In `wrangler.toml`:**
- `API_URL` - API server endpoint
- `ENVIRONMENT` - `prod`, `dev`, or `local`
- `AXIOM_OTEL_DATASET` / `AXIOM_LOGS_DATASET` - Observability datasets

**Secrets (via `wrangler secret put`):**
- `WORKER_SECRET` - Auth for API calls
- `EXTENSION_SECRET` - Auth for upload endpoint (must match extension's `VITE_EXTENSION_SECRET`, used only in background script)
- `OPENAI_API_KEY` - LLM access
- `AXIOM_API_TOKEN` - Observability

### Local Development

Create `.dev.vars` (see `.dev.vars.example`):
```bash
API_URL=http://0.0.0.0:5050
WORKER_SECRET=your-secret
EXTENSION_SECRET=your-extension-secret
OPENAI_API_KEY=sk-...
AXIOM_API_TOKEN=your-token
```

### Queue Consumer Settings

Configure in Cloudflare Dashboard → Queues → `parse-cv` → Consumers:
- **Batch size**: 10
- **Max wait time**: 5 seconds
- **Max retries**: 3
- **Dead Letter Queue**: `parse-cv-dlq`

## Commands

```bash
pnpm dev              # Local development
pnpm deploy           # Deploy to production
pnpm deploy --env dev # Deploy to dev
pnpm tail             # View live logs
```

## Message Structure

```typescript
interface ParseCVQueueMessage {
  uploadId: string;   // MongoDB _id (to fetch rawText)
  fileId: string;     // R2 object key
  processId: string;  // Outbox entry ID
  userId: string;
  fileType: "PDF" | "DOCX";
}
```

## CV Extraction

Uses Vercel AI SDK with GPT-4o-mini to extract:
- Personal info (name, email, phone, location)
- Links (LinkedIn, GitHub, portfolio)
- Experience, Education, Certifications
- Languages, Skills, Extras

**Cost per CV**: ~$0.001-0.003 (less than half a cent)

## Observability

OpenTelemetry traces sent to Axiom:
- `processMessage` - Overall processing
- `fetchRawText` - API call to get text
- `extractCVData` - AI extraction
- `updateOutboxStatus` - Result callback

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Upload returns 403 | Check `EXTENSION_SECRET` matches extension's `VITE_EXTENSION_SECRET` |
| Messages not consumed | Check consumer is connected in Dashboard |
| Messages going to DLQ | Check worker logs: `wrangler tail` |
| API unreachable | Verify `API_URL` and `WORKER_SECRET` |
| OpenAI errors | Check `OPENAI_API_KEY` is set |

## Deployment

**GitHub Actions** (`.github/workflows/deploy-upload-consumer.yml`):
- Push to `main` → deploys to production
- Manual trigger available

**Manual:**
```bash
wrangler deploy           # Production
wrangler deploy --env dev # Dev environment
```

**Secrets per environment:**
```bash
wrangler secret put WORKER_SECRET
wrangler secret put EXTENSION_SECRET
wrangler secret put OPENAI_API_KEY
wrangler secret put AXIOM_API_TOKEN

# For dev:
wrangler secret put WORKER_SECRET --env dev
wrangler secret put EXTENSION_SECRET --env dev
```
