# Deployment Guide - Upload Queue Consumer

## Overview

This Cloudflare Queue Consumer worker processes CV/resume files asynchronously:

1. **Downloads** files from R2 storage
2. **Validates** file size against limits
3. **Extracts** text from PDF/DOCX files
4. **Parses** CV data using OpenAI GPT-4o-mini
5. **Updates** status via your API endpoint

The worker is **stateless** and delegates database operations to your API server. It includes OpenTelemetry tracing (Axiom) and structured logging for observability.

## Architecture

```
Cloudflare Queue → Worker → Download from R2 → Extract Text → OpenAI GPT-4o-mini → Update API → MongoDB
                                                                                      ↓
                                                                              Axiom (Traces & Logs)
```

## Configuration

### Environment Variables

**Required Variables:**

1. **`API_URL`** - Your API server endpoint (e.g., `https://api.yourapp.com`)
2. **`ENVIRONMENT`** - `prod`, `dev`, or `local`
3. **`WORKER_SECRET`** - Authentication secret for API calls (set via `wrangler secret put`)
4. **`OPENAI_API_KEY`** - OpenAI API key for CV parsing (set via `wrangler secret put`)
5. **`AXIOM_API_TOKEN`** - Axiom API token for observability (set via `wrangler secret put`)
6. **`AXIOM_OTEL_DATASET`** - Axiom dataset for OpenTelemetry traces (e.g., `otel-upload-queue-consumer`)
7. **`AXIOM_LOGS_DATASET`** - Axiom dataset for structured logs (e.g., `upload-queue-consumer`)

**Bindings (configured in `wrangler.toml`):**
- **`UPLOADS_BUCKET`** - R2 bucket binding for file storage
- **`PARSE_CV_DLQ`** - Dead Letter Queue binding for failed messages

### Configuration Files

#### `.dev.vars` (Local Development)
```bash
# Copy from .dev.vars.example and fill in your values
API_URL=http://0.0.0.0:5050
WORKER_SECRET=your-worker-secret-here
OPENAI_API_KEY=your-openai-api-key-here
AXIOM_API_TOKEN=your-axiom-api-token-here

# R2 credentials (if using remote R2 in local dev)
R2_BUCKET_NAME=dev
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
```

#### `wrangler.toml` (Production)
```toml
[vars]
ENVIRONMENT = "prod"
API_URL = "https://api.yourapp.com"  # Update this!
AXIOM_OTEL_DATASET = "otel-upload-queue-consumer"
AXIOM_LOGS_DATASET = "upload-queue-consumer"

# Secrets (set via wrangler secret put):
# - WORKER_SECRET
# - OPENAI_API_KEY
# - AXIOM_API_TOKEN
```

#### `wrangler.toml` (Dev Environment)
```toml
[env.dev.vars]
ENVIRONMENT = "dev"
API_URL = "https://lazzyapply-api-dev.onrender.com"
AXIOM_OTEL_DATASET = "otel-upload-queue-consumer"
AXIOM_LOGS_DATASET = "upload-queue-consumer"
```

### API Endpoint Required

Your API must have this endpoint:

```typescript
PATCH /api/outbox/:processId
Body: {
  status: "completed" | "failed",
  data: ParsedCVData | null,
  error?: string
}
```

## Local Testing

```bash
# 1. Start your API server first
cd apps/api
pnpm dev  # Runs on localhost:5050

# 2. In another terminal, start the worker
cd apps/upload-queue-consumer
pnpm dev  # Runs on localhost:8787

# 3. Test with a message
curl -X POST http://localhost:8787/ \
  -H "Content-Type: application/json" \
  -d '{
    "uploadId": "upload-123",
    "fileId": "test-file-123",
    "processId": "507f1f77bcf86cd799439011",
    "userId": "user-123",
    "fileType": "application/pdf"
  }'
```

**Note:** For local testing, ensure you have:
- R2 bucket with test files in the `cv/` directory
- `.dev.vars` file with required secrets (see `.dev.vars.example`)

## Production Deployment

### Setup Steps

### 1. Get Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use template: **Edit Cloudflare Workers**
4. Or create custom token with permissions:
   - Account → Workers Scripts → Edit
   - Account → Workers KV Storage → Edit (if using KV)
   - Account → Account Settings → Read
5. Copy the generated token

### 2. Set Up GitHub Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret:

```
Name: CLOUDFLARE_API_TOKEN
Value: <your-cloudflare-api-token>
```

**Note:** No other secrets needed! The worker only needs `API_URL` which is set in `wrangler.toml` (not a secret).

### 3. Deployment Methods

#### Option A: GitHub Actions (Automated)

The workflow is already set up in `.github/workflows/deploy-upload-consumer.yml`

**Triggers:**
- Push to `main` branch with changes to `apps/upload-queue-consumer/`
- Manual trigger via GitHub Actions UI

**What it does:**
```bash
1. Checkout code
2. Install pnpm and Node.js
3. Install dependencies
4. Run: wrangler deploy
5. Update secrets
```

#### Option B: Manual Deployment (Direct CLI)

```bash
# Set environment variable
export CLOUDFLARE_API_TOKEN="your-token-here"

# Run deployment script
cd apps/upload-queue-consumer
chmod +x deploy.sh
./deploy.sh
```

Or directly:

```bash
cd apps/upload-queue-consumer
export CLOUDFLARE_API_TOKEN="your-token-here"
pnpm deploy
```

#### Option C: GitLab CI

Create `.gitlab-ci.yml`:

```yaml
deploy-worker:
  stage: deploy
  image: node:20
  only:
    - main
  script:
    - corepack enable
    - pnpm install --frozen-lockfile
    - cd apps/upload-queue-consumer
    - pnpm wrangler deploy
  variables:
    CLOUDFLARE_API_TOKEN: $CLOUDFLARE_API_TOKEN
```

#### Option D: Other CI/CD Platforms

**CircleCI:**
```yaml
version: 2.1
jobs:
  deploy:
    docker:
      - image: node:20
    steps:
      - checkout
      - run: corepack enable
      - run: pnpm install
      - run: cd apps/upload-queue-consumer && pnpm wrangler deploy
workflows:
  deploy-worker:
    jobs:
      - deploy:
          filters:
            branches:
              only: main
```

**Jenkins:**
```groovy
pipeline {
  agent any
  stages {
    stage('Deploy') {
      steps {
        sh 'pnpm install'
        sh 'cd apps/upload-queue-consumer && CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN} pnpm wrangler deploy'
      }
    }
  }
}
```

## Environment Configuration

### Wrangler Authentication Methods

**1. API Token (Recommended for CI/CD)**
```bash
export CLOUDFLARE_API_TOKEN="your-token"
wrangler deploy
```

**2. Email + Global API Key (Legacy, not recommended)**
```bash
export CLOUDFLARE_EMAIL="you@example.com"
export CLOUDFLARE_API_KEY="your-key"
wrangler deploy
```

**3. Interactive Login (Local development only)**
```bash
wrangler login  # Opens browser for OAuth
wrangler deploy
```

## Managing Secrets in Production

Secrets (sensitive values) must be set separately using `wrangler secret put`:

**Required Secrets:**
- `WORKER_SECRET` - Authentication secret for API calls
- `OPENAI_API_KEY` - OpenAI API key for CV parsing
- `AXIOM_API_TOKEN` - Axiom API token for observability

### During Deployment (Automated)

In GitHub Actions (already configured):
```yaml
- name: Set secrets
  run: |
    echo "${{ secrets.WORKER_SECRET }}" | pnpm wrangler secret put WORKER_SECRET
    echo "${{ secrets.OPENAI_API_KEY }}" | pnpm wrangler secret put OPENAI_API_KEY
    echo "${{ secrets.AXIOM_API_TOKEN }}" | pnpm wrangler secret put AXIOM_API_TOKEN
```

### Manual Secret Updates

```bash
# Set individual secrets
wrangler secret put WORKER_SECRET
# Enter value when prompted

# Or pipe from environment
echo "$WORKER_SECRET" | wrangler secret put WORKER_SECRET
echo "$OPENAI_API_KEY" | wrangler secret put OPENAI_API_KEY
echo "$AXIOM_API_TOKEN" | wrangler secret put AXIOM_API_TOKEN

# List all secrets
wrangler secret list

# Delete a secret
wrangler secret delete WORKER_SECRET
```

## Deployment Workflow

```
┌─────────────────┐
│  Push to main   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ GitHub Actions  │
│   triggered     │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ pnpm install    │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ wrangler deploy │  ← Uses CLOUDFLARE_API_TOKEN
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Set secrets     │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Worker live on  │
│ Cloudflare Edge │
└─────────────────┘
```

## Verifying Deployment

### Check Deployment Status

```bash
# View recent deployments
wrangler deployments list

# View worker status
wrangler tail --format pretty
```

### Test the Worker

```bash
# Send a test message to the queue
curl -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/queues/parse-cv/messages" \
  -H "Authorization: Bearer $CLOUDFLARE_QUEUE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body": {"fileId": "test", "processId": "test", "userId": "test"}}'

# Watch logs
wrangler tail
```

## Environments

The project supports multiple deployment environments:

### Available Environments

1. **Production** (default) - Deploys from `main` branch
2. **Dev/Staging** - Deploys from `dev` or `develop` branch

**wrangler.toml configuration:**
```toml
name = "upload-queue-consumer"  # Production

[env.dev]
name = "upload-queue-consumer-dev"
# Separate queues: parse-cv-dev, parse-cv-dlq-dev
# Separate R2 bucket: lazy-job-uploads-dev
```

### Deploy to Specific Environment

**Via GitHub Actions:**
- Push to `main` → deploys to **both production and dev**

**Manual deployment:**
```bash
# Production
wrangler deploy

# Dev
wrangler deploy --env dev
```

### Environment-Specific Secrets

Each environment has its own secrets. Set them using:

```bash
# Production secrets
wrangler secret put WORKER_SECRET
wrangler secret put OPENAI_API_KEY
wrangler secret put AXIOM_API_TOKEN

# Dev secrets
wrangler secret put WORKER_SECRET --env dev
wrangler secret put OPENAI_API_KEY --env dev
wrangler secret put AXIOM_API_TOKEN --env dev
```

### GitHub Secrets Required

**For Production:**
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token for deployment
- `WORKER_SECRET` - Authentication secret for API calls
- `OPENAI_API_KEY` - OpenAI API key for CV parsing
- `AXIOM_API_TOKEN` - Axiom API token for observability

**For Dev:**
- `CLOUDFLARE_API_TOKEN` (same token)
- `DEV_WORKER_SECRET` - Dev environment authentication secret
- `DEV_OPENAI_API_KEY` - Dev environment OpenAI API key
- `DEV_AXIOM_API_TOKEN` - Dev environment Axiom API token

**Note:** `API_URL` and Axiom dataset names are set in `wrangler.toml` (not secrets)

## Rollback

If deployment fails or has issues:

```bash
# View deployment history
wrangler deployments list

# Rollback to previous version
wrangler rollback [deployment-id]
```

## Monitoring

### View Logs
```bash
# Real-time logs
wrangler tail

# Filter by status
wrangler tail --status error

# JSON format
wrangler tail --format json
```

### Cloudflare Dashboard

1. Go to **Workers & Pages**
2. Click **upload-queue-consumer**
3. View:
   - Requests per second
   - Success rate
   - CPU time
   - Logs

## Troubleshooting

### Authentication Error
```
Error: Not authenticated
```
**Solution:** Check `CLOUDFLARE_API_TOKEN` is set correctly

### Deployment Fails
```
Error: Worker has errors
```
**Solution:** 
1. Run `pnpm install` first
2. Check TypeScript errors
3. Test locally with `pnpm dev`

### Secrets Not Set
```
Error: Environment variable X is undefined
```
**Solution:** Set secrets using `wrangler secret put`

## Cost & Limits

**Cloudflare Workers Free Tier:**
- 100,000 requests/day
- 10ms CPU time per request
- Unlimited duration (for queue consumers)

**Paid Plan ($5/month):**
- 10 million requests/month included
- $0.50 per additional million
- 50ms CPU time per request

Queue consumers have **no timeout limits** - perfect for long-running tasks like CV parsing!

## Best Practices

1. **Use API Tokens** (not Global API Key)
2. **Pin wrangler version** in package.json for consistency
3. **Test locally** with `wrangler dev` before deploying
4. **Use environments** for staging/production
5. **Monitor logs** after deployment
6. **Set up alerts** for errors in Cloudflare Dashboard
7. **Keep secrets in CI/CD secrets**, never in code
8. **Use `--dry-run`** flag to preview changes:
   ```bash
   wrangler deploy --dry-run
   ```

## Security Notes

- ✅ API Token has scoped permissions (only Workers access)
- ✅ Secrets are encrypted at rest
- ✅ Worker code is minified and obfuscated
- ✅ No access to local file system
- ⚠️ Never commit `CLOUDFLARE_API_TOKEN` to git
- ⚠️ Rotate tokens regularly
- ⚠️ Use different tokens for different environments

## Quick Reference

```bash
# Deploy
wrangler deploy

# Deploy with dry run
wrangler deploy --dry-run

# View logs
wrangler tail

# List deployments
wrangler deployments list

# Rollback
wrangler rollback [id]

# Set secret
wrangler secret put SECRET_NAME

# List secrets
wrangler secret list

# Generate types
wrangler types
```
