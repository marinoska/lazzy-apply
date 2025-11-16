# Dev Environment Setup Guide

This guide will help you set up and deploy the upload-queue-consumer to the dev environment on Cloudflare.

## Prerequisites

1. Cloudflare account with Workers enabled
2. GitHub repository with Actions enabled
3. Cloudflare API Token (see main DEPLOYMENT.md for instructions)

## Step 1: Create Cloudflare Resources

You need to create the following resources in your Cloudflare account:

### Queues

Create two queues for the dev environment:

```bash
# Main queue
wrangler queues create parse-cv-dev

# Dead letter queue
wrangler queues create parse-cv-dlq-dev
```

### R2 Bucket

Create a separate R2 bucket for dev:

```bash
wrangler r2 bucket create dyno-job-uploads-dev
```

## Step 2: Set Up GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

Add the following secrets for the dev environment:

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `CLOUDFLARE_API_TOKEN` | Your Cloudflare API token | (same as production) |
| `DEV_API_URL` | Dev API endpoint | `https://api-dev.yourapp.com` |
| `DEV_MONGO_CONNECTION` | Dev MongoDB connection string | `mongodb+srv://...` |
| `DEV_R2_BUCKET_NAME` | Dev R2 bucket name | `dyno-job-uploads-dev` |
| `DEV_R2_ACCESS_KEY_ID` | R2 access key ID | `...` |
| `DEV_R2_SECRET_ACCESS_KEY` | R2 secret access key | `...` |
| `DEV_R2_ENDPOINT` | R2 endpoint URL | `https://<account-id>.r2.cloudflarestorage.com` |

## Step 3: Deploy

### Option A: Automatic Deployment (Recommended)

Push changes to the `main` branch:

```bash
git checkout main
git add .
git commit -m "Deploy changes"
git push origin main
```

The GitHub Actions workflow will automatically deploy to both production and dev. For dev environment, it will:
1. Build the worker
2. Deploy to Cloudflare (dev environment)
3. Set all secrets

### Option B: Manual Deployment

Deploy directly from your local machine:

```bash
cd apps/upload-queue-consumer

# Deploy to dev environment
pnpm deploy --env dev

# Set secrets manually
wrangler secret put API_URL --env dev
wrangler secret put MONGO_CONNECTION --env dev
wrangler secret put R2_BUCKET_NAME --env dev
wrangler secret put R2_ACCESS_KEY_ID --env dev
wrangler secret put R2_SECRET_ACCESS_KEY --env dev
wrangler secret put R2_ENDPOINT --env dev
```

## Step 4: Verify Deployment

Check that the worker is running:

```bash
# View deployments
wrangler deployments list --env dev

# View logs
wrangler tail --env dev

# List secrets
wrangler secret list --env dev
```

## Testing the Dev Environment

Send a test message to the dev queue:

```bash
# Using wrangler
wrangler queues producer parse-cv-dev send '{"fileId": "test", "logId": "test", "userId": "test"}'

# Watch the logs
wrangler tail --env dev
```

## Monitoring

### View Logs in Real-Time

```bash
wrangler tail --env dev --format pretty
```

### Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages**
3. Find **upload-queue-consumer-dev**
4. View metrics, logs, and settings

## Troubleshooting

### Worker Not Found

Make sure you've deployed with the `--env dev` flag:
```bash
wrangler deploy --env dev
```

### Queue Not Found

Create the queues if they don't exist:
```bash
wrangler queues create parse-cv-dev
wrangler queues create parse-cv-dlq-dev
```

### Secrets Not Set

Verify secrets are set correctly:
```bash
wrangler secret list --env dev
```

If missing, set them:
```bash
wrangler secret put SECRET_NAME --env dev
```

### GitHub Actions Failing

Check that all GitHub secrets are set with the `DEV_` prefix:
- `DEV_API_URL`
- `DEV_MONGO_CONNECTION`
- etc.

## Switching Between Environments

```bash
# Deploy to dev
wrangler deploy --env dev

# Deploy to production
wrangler deploy

# View dev logs
wrangler tail --env dev

# View production logs
wrangler tail
```

## Clean Up

To remove the dev environment:

```bash
# Delete worker
wrangler delete --env dev

# Delete queues
wrangler queues delete parse-cv-dev
wrangler queues delete parse-cv-dlq-dev

# Delete R2 bucket (make sure it's empty first)
wrangler r2 bucket delete dyno-job-uploads-dev
```

## Next Steps

- Set up monitoring and alerts in Cloudflare Dashboard
- Configure error tracking (e.g., Sentry)
- Set up automated testing before deployment
- Document any dev-specific configuration differences
