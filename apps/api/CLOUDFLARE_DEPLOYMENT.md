# API Cloudflare Deployment Options

The DynoJob API is currently an Express.js application with:
- MongoDB connections
- Background workers (outbox processor, pending uploads monitor)
- Long-running processes
- Node.js-specific dependencies

## Deployment Options for Cloudflare

### Option 1: Cloudflare Pages with Functions (Recommended for Simple APIs)

Cloudflare Pages supports full-stack applications with serverless functions.

**Pros:**
- Easy deployment from Git
- Automatic HTTPS
- Global CDN
- Preview deployments

**Cons:**
- Functions have 10s timeout (not suitable for background workers)
- Limited Node.js compatibility
- Would require significant refactoring

### Option 2: Cloudflare Workers with Node.js Compatibility

Use Cloudflare Workers' Node.js compatibility layer.

**Pros:**
- Fast global edge deployment
- Good for stateless APIs

**Cons:**
- Background workers won't work (no long-running processes)
- MongoDB connections need special handling (connection pooling issues)
- 30s CPU time limit
- Requires refactoring

### Option 3: Hybrid Approach (Recommended)

Keep the current architecture:
- **API**: Deploy to a Node.js platform (Render, Railway, Fly.io, or traditional VPS)
- **Queue Consumer**: Already on Cloudflare Workers ✅
- **Functions**: Already on Supabase ✅

**Why this works:**
- API needs long-running background workers
- API maintains persistent MongoDB connections
- Queue consumer handles async CV parsing on CF Workers
- Clean separation of concerns

## Recommended: Deploy API to Node.js Platform

### Option A: Render.com

```yaml
# render.yaml
services:
  - type: web
    name: dyno-job-api
    env: node
    buildCommand: pnpm install && pnpm --filter @lazyapply/api build
    startCommand: pnpm --filter @lazyapply/api start
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGO_CONNECTION
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: R2_ACCESS_KEY_ID
        sync: false
      - key: R2_SECRET_ACCESS_KEY
        sync: false
```

### Option B: Railway.app

```toml
# railway.toml
[build]
builder = "NIXPACKS"
buildCommand = "pnpm install && pnpm --filter @lazyapply/api build"

[deploy]
startCommand = "pnpm --filter @lazyapply/api start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

### Option C: Fly.io

```toml
# fly.toml
app = "dyno-job-api"

[build]
  builder = "paketobuildpacks/builder:base"

[env]
  PORT = "8080"
  NODE_ENV = "production"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

## If You Must Use Cloudflare Workers

### Required Refactoring

1. **Remove Background Workers**
   - Move outbox processor logic to a separate Cloudflare Worker with Cron Triggers
   - Move pending uploads monitor to another Worker with Cron Triggers

2. **Handle MongoDB Connections**
   - Use MongoDB Data API (HTTP-based) instead of native driver
   - Or use Cloudflare D1 (SQLite) or Durable Objects for state

3. **Simplify to Stateless API**
   - Each request must be independent
   - No in-memory state
   - No long-running processes

### Example: Cron Trigger for Background Jobs

```toml
# wrangler.toml
[triggers]
crons = ["*/5 * * * *"]  # Every 5 minutes

# Separate worker for outbox processor
name = "dyno-job-outbox-processor"
main = "src/workers/outboxProcessor.ts"
```

## Current Recommendation

**Keep the hybrid approach:**

1. **API (Node.js)** → Deploy to Render/Railway/Fly.io
   - Handles HTTP requests
   - Runs background workers
   - Maintains MongoDB connections

2. **Queue Consumer (CF Workers)** → Already deployed ✅
   - Processes CV parsing jobs
   - Triggered by queue messages
   - Stateless, event-driven

3. **Extension** → Chrome Web Store
4. **Functions** → Supabase Edge Functions

This gives you:
- ✅ Best performance for each component
- ✅ No refactoring required
- ✅ Proper separation of concerns
- ✅ Cost-effective (CF Workers for async jobs, Node.js for API)

## Environment-Specific Deployments

### Production
- API: `api.dynojob.com` (Render/Railway/Fly.io)
- Queue Consumer: `upload-queue-consumer` (CF Workers)

### Dev/Staging
- API: `api-dev.dynojob.com` (Render/Railway/Fly.io)
- Queue Consumer: `upload-queue-consumer-dev` (CF Workers)

## Next Steps

1. Choose a Node.js hosting platform for the API
2. Set up environment-specific deployments (prod/dev)
3. Configure GitHub Actions for API deployment
4. Keep queue consumer on CF Workers (already done)
