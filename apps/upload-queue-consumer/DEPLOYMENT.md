# Deployment Guide - Upload Queue Consumer

## Overview

This worker processes CV files from the queue and updates status via your API endpoint. **No MongoDB configuration needed in the worker** - it simply calls your existing API.

## Architecture

```
Queue Message → Worker → Process CV → Update via API → Your API handles MongoDB
```

The worker is **stateless** and delegates database operations to your API server.

## Configuration

### Environment Variables

Only two variables needed:

1. **`API_URL`** - Your API server endpoint
2. **`ENVIRONMENT`** - `prod` or `dev`

### Configuration Files

#### `.dev.vars` (Local Development)
```bash
API_URL=http://localhost:5050
```

#### `wrangler.toml` (Production)
```toml
[vars]
ENVIRONMENT = "prod"
API_URL = "https://api.yourapp.com"  # Update this!
```

#### `wrangler.toml` (Dev Environment)
```toml
[env.dev.vars]
ENVIRONMENT = "dev"
API_URL = "http://localhost:5050"
```

### API Endpoint Required

Your API must have this endpoint:

```typescript
PATCH /api/outbox/:logId
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
    "fileId": "test-file-123",
    "logId": "507f1f77bcf86cd799439011",
    "userId": "user-123"
  }'
```

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

Secrets (like `API_URL`, `MONGO_CONNECTION`) need to be set separately:

### During Deployment (Automated)

In GitHub Actions (already configured):
```yaml
- name: Set secrets
  run: |
    echo "${{ secrets.API_URL }}" | pnpm wrangler secret put API_URL
    echo "${{ secrets.MONGO_CONNECTION }}" | pnpm wrangler secret put MONGO_CONNECTION
```

### Manual Secret Updates

```bash
# Set individual secrets
wrangler secret put API_URL
# Enter value when prompted

# Or pipe from environment
echo "$API_URL" | wrangler secret put API_URL

# List all secrets
wrangler secret list

# Delete a secret
wrangler secret delete API_URL
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
  -d '{"body": {"fileId": "test", "logId": "test", "userId": "test"}}'

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
# Separate R2 bucket: dyno-job-uploads-dev
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
wrangler secret put API_URL
wrangler secret put MONGO_CONNECTION

# Dev secrets
wrangler secret put API_URL --env dev
wrangler secret put MONGO_CONNECTION --env dev
```

### GitHub Secrets Required

**For Production:**
- `CLOUDFLARE_API_TOKEN`
- `API_URL`
- `MONGO_CONNECTION`
- `R2_BUCKET_NAME`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT`

**For Dev:**
- `CLOUDFLARE_API_TOKEN` (same token)
- `DEV_API_URL`
- `DEV_MONGO_CONNECTION`
- `DEV_R2_BUCKET_NAME`
- `DEV_R2_ACCESS_KEY_ID`
- `DEV_R2_SECRET_ACCESS_KEY`
- `DEV_R2_ENDPOINT`

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
