# Production Deployment Guide

## Overview

The `upload-queue-consumer` worker is deployed to Cloudflare Workers using Wrangler CLI in CI/CD pipelines.

## Setup Steps

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

Name: API_URL
Value: https://api.yourapp.com

Name: MONGO_CONNECTION
Value: mongodb+srv://...
```

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

## Environments (Optional)

You can deploy to multiple environments:

**wrangler.toml:**
```toml
name = "upload-queue-consumer"

[env.staging]
name = "upload-queue-consumer-staging"

[env.production]
name = "upload-queue-consumer-production"
```

**Deploy to specific environment:**
```bash
# Staging
wrangler deploy --env staging

# Production
wrangler deploy --env production
```

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
