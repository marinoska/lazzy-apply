# API Deployment Guide

## Overview

The LazyJob API is a Node.js Express application that requires:
- Persistent MongoDB connections
- Background workers (outbox processor, pending uploads monitor)
- Long-running processes
- R2/S3 storage access

## Recommended Deployment Platforms

### Option 1: Render.com (Recommended)

**Pros:**
- Easy setup from Git
- Free tier available
- Automatic deployments
- Environment management
- Health checks

**Setup:**

1. Create `render.yaml` in the project root (already provided below)
2. Connect your GitHub repo to Render
3. Set environment variables in Render dashboard
4. Deploy!

### Option 2: Railway.app

**Pros:**
- Simple deployment
- Good developer experience
- Automatic HTTPS
- Preview environments

**Setup:**

1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Initialize: `railway init`
4. Deploy: `railway up`

### Option 3: Fly.io

**Pros:**
- Global edge deployment
- Good for low-latency
- Docker-based

**Setup:**

1. Install Fly CLI: `brew install flyctl`
2. Login: `fly auth login`
3. Launch: `fly launch`
4. Deploy: `fly deploy`

## Environment Setup

### Required Environment Variables

**Production:**
- `NODE_ENV=production`
- `PORT=8080` (or platform default)
- `HOST=0.0.0.0`
- `MONGO_CONNECTION` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `ALLOWED_ORIGIN_LIST` - Comma-separated list of allowed origins
- `R2_BUCKET_NAME` - R2 bucket name
- `R2_ACCESS_KEY_ID` - R2 access key
- `R2_SECRET_ACCESS_KEY` - R2 secret key
- `R2_ENDPOINT` - R2 endpoint URL

**Dev/Staging:**
Same as production but with dev-specific values:
- `MONGO_CONNECTION` - Dev MongoDB
- `R2_BUCKET_NAME=lazy-job-uploads-dev`
- etc.

## Deployment Configurations

### Render.com

Create `render.yaml` in project root:

```yaml
services:
  # Production API
  - type: web
    name: lazy-job-api
    env: node
    region: oregon
    plan: starter
    buildCommand: pnpm install && pnpm --filter @lazyapply/api build
    startCommand: pnpm --filter @lazyapply/api start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 8080
      - key: HOST
        value: 0.0.0.0
      - key: MONGO_CONNECTION
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: ALLOWED_ORIGIN_LIST
        sync: false
      - key: R2_BUCKET_NAME
        sync: false
      - key: R2_ACCESS_KEY_ID
        sync: false
      - key: R2_SECRET_ACCESS_KEY
        sync: false
      - key: R2_ENDPOINT
        sync: false
    
  # Dev/Staging API
  - type: web
    name: lazy-job-api-dev
    env: node
    region: oregon
    plan: starter
    branch: dev
    buildCommand: pnpm install && pnpm --filter @lazyapply/api build
    startCommand: pnpm --filter @lazyapply/api start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: development
      - key: PORT
        value: 8080
      - key: HOST
        value: 0.0.0.0
      - key: MONGO_CONNECTION
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: ALLOWED_ORIGIN_LIST
        sync: false
      - key: R2_BUCKET_NAME
        value: lazy-job-uploads-dev
      - key: R2_ACCESS_KEY_ID
        sync: false
      - key: R2_SECRET_ACCESS_KEY
        sync: false
      - key: R2_ENDPOINT
        sync: false
```

### Railway.app

Create `railway.toml`:

```toml
[build]
builder = "NIXPACKS"
buildCommand = "pnpm install && pnpm --filter @lazyapply/api build"

[deploy]
startCommand = "pnpm --filter @lazyapply/api start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
healthcheckPath = "/health"
healthcheckTimeout = 100

[environments.production]
# Set via Railway dashboard

[environments.dev]
# Set via Railway dashboard
```

### Fly.io

Create `apps/api/fly.toml`:

```toml
app = "lazy-job-api"
primary_region = "sjc"

[build]
  [build.args]
    NODE_VERSION = "20"

[env]
  PORT = "8080"
  HOST = "0.0.0.0"
  NODE_ENV = "production"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

  [[http_service.checks]]
    interval = "30s"
    timeout = "5s"
    grace_period = "10s"
    method = "GET"
    path = "/health"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

For dev environment, create `apps/api/fly.dev.toml`:

```toml
app = "lazy-job-api-dev"
primary_region = "sjc"

[build]
  [build.args]
    NODE_VERSION = "20"

[env]
  PORT = "8080"
  HOST = "0.0.0.0"
  NODE_ENV = "development"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

  [[http_service.checks]]
    interval = "30s"
    timeout = "5s"
    grace_period = "10s"
    method = "GET"
    path = "/health"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

## GitHub Actions Workflows

### Production Deployment

Create `.github/workflows/deploy-api-production.yml`:

```yaml
name: Deploy API (Production)

on:
  push:
    branches:
      - main
    paths:
      - 'apps/api/**'
      - 'packages/**'
      - '.github/workflows/deploy-api-production.yml'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm --filter @lazyapply/api build

      # Render.com deployment (automatic via Git push)
      # Or use Render API:
      - name: Trigger Render Deploy
        if: github.ref == 'refs/heads/main'
        run: |
          curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK_URL }}"

      # Railway deployment
      # - name: Deploy to Railway
      #   uses: bervProject/railway-deploy@main
      #   with:
      #     railway_token: ${{ secrets.RAILWAY_TOKEN }}
      #     service: lazy-job-api

      # Fly.io deployment
      # - name: Deploy to Fly.io
      #   uses: superfly/flyctl-actions/setup-flyctl@master
      # - run: flyctl deploy --remote-only
      #   env:
      #     FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

### Dev Deployment

Create `.github/workflows/deploy-api-dev.yml`:

```yaml
name: Deploy API (Dev)

on:
  push:
    branches:
      - dev
      - develop
    paths:
      - 'apps/api/**'
      - 'packages/**'
      - '.github/workflows/deploy-api-dev.yml'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm --filter @lazyapply/api build

      - name: Trigger Render Deploy (Dev)
        run: |
          curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK_URL_DEV }}"
```

## Health Check Endpoint

Add a health check endpoint to your API:

```typescript
// apps/api/src/routes/health.ts
import type { Request, Response } from "express";

export const healthCheck = (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};

// In apps/api/src/routes/index.ts
app.get("/health", healthCheck);
```

## Deployment Checklist

### Initial Setup

- [ ] Choose deployment platform (Render/Railway/Fly.io)
- [ ] Create account and connect GitHub repo
- [ ] Set up production environment variables
- [ ] Set up dev environment variables
- [ ] Configure deployment hooks/tokens
- [ ] Add health check endpoint
- [ ] Test local build: `pnpm --filter @lazyapply/api build`

### Production Deployment

- [ ] Push to `main` branch
- [ ] Verify deployment in platform dashboard
- [ ] Check health endpoint: `https://api.lazyjob.com/health`
- [ ] Monitor logs for errors
- [ ] Verify MongoDB connection
- [ ] Verify R2 storage access
- [ ] Test API endpoints

### Dev Deployment

- [ ] Push to `main` branch (deploys both prod and dev)
- [ ] Verify dev deployment in platform dashboard
- [ ] Check health endpoint: `https://api-dev.lazyjob.com/health`
- [ ] Monitor logs for errors

## Monitoring

### Logs

**Render:**
```bash
# View logs in dashboard or CLI
render logs -s lazy-job-api
```

**Railway:**
```bash
railway logs
```

**Fly.io:**
```bash
flyctl logs
```

### Metrics

Monitor in platform dashboard:
- Request rate
- Response times
- Error rates
- Memory usage
- CPU usage

## Troubleshooting

### Build Fails

```bash
# Test build locally
pnpm install
pnpm --filter @lazyapply/api build
```

### MongoDB Connection Issues

- Verify `MONGO_CONNECTION` string is correct
- Check MongoDB Atlas IP whitelist (allow 0.0.0.0/0 for cloud platforms)
- Verify MongoDB user has correct permissions

### R2 Storage Issues

- Verify R2 credentials are correct
- Check R2 bucket exists
- Verify CORS settings on R2 bucket

### Background Workers Not Running

- Check logs for worker startup messages
- Verify workers are started in `src/index.ts`
- Check for MongoDB connection before starting workers

## Cost Estimates

### Render.com
- Free tier: 750 hours/month
- Starter: $7/month per service
- Standard: $25/month per service

### Railway.app
- $5/month base + usage
- ~$10-20/month for small API

### Fly.io
- Free tier: 3 shared-cpu VMs
- Paid: ~$5-10/month for small API

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   LazyJob Platform                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐      ┌──────────────────────┐   │
│  │   Extension  │─────▶│  API (Node.js)       │   │
│  │  (Chrome)    │      │  - Render/Railway    │   │
│  └──────────────┘      │  - Express + MongoDB │   │
│                        │  - Background Workers│   │
│                        └──────────┬───────────┘   │
│                                   │               │
│                                   │ Sends jobs    │
│                                   ▼               │
│                        ┌──────────────────────┐   │
│                        │  Queue Consumer      │   │
│                        │  (CF Workers)        │   │
│                        │  - Parses CVs        │   │
│                        └──────────────────────┘   │
│                                                     │
│  ┌──────────────┐                                  │
│  │  Functions   │                                  │
│  │  (Supabase)  │                                  │
│  └──────────────┘                                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Next Steps

1. Choose your deployment platform
2. Set up production environment
3. Set up dev environment
4. Configure GitHub Actions
5. Deploy and test!
