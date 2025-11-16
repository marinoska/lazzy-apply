# Deployment Strategy

## Single Branch, Dual Environment

This project uses a **single `main` branch** that deploys to **both production and dev environments simultaneously**.

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    git push origin main                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ├─────────────────┬──────────────────┐
                     ▼                 ▼                  ▼
              ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
              │   API Prod  │   │   API Dev   │   │Queue Consumer│
              │   (Render)  │   │   (Render)  │   │  (CF Workers)│
              │             │   │             │   │              │
              │ dyno-job-   │   │ dyno-job-   │   │ prod + dev   │
              │    api      │   │   api-dev   │   │ environments │
              └─────────────┘   └─────────────┘   └─────────────┘
```

## Why This Approach?

### Benefits
✅ **Simplicity** - Only one branch to manage  
✅ **Consistency** - Same code in both environments  
✅ **Fast Testing** - Dev environment always up-to-date  
✅ **No Merge Conflicts** - No need to merge dev → main  
✅ **Parallel Deployment** - Both environments deploy at once  

### Trade-offs
⚠️ **No Staging Gate** - Changes go to both environments immediately  
⚠️ **Shared Codebase** - Can't have different code in dev vs prod  
⚠️ **Resource Usage** - Both environments rebuild on every push  

## Environment Differentiation

Environments are separated by:

### 1. API (Render.com)
- **Production**: Service name `dyno-job-api`
- **Dev**: Service name `dyno-job-api-dev`
- Both deploy from `main` branch
- Different environment variables

### 2. Queue Consumer (Cloudflare Workers)
- **Production**: Default environment (no flag)
- **Dev**: `--env dev` flag
- Both deploy from `main` branch
- Different queues, R2 buckets, secrets

### 3. Resources
| Resource | Production | Dev |
|----------|-----------|-----|
| **Queue** | `parse-cv` | `parse-cv-dev` |
| **DLQ** | `parse-cv-dlq` | `parse-cv-dlq-dev` |
| **R2 Bucket** | `dyno-job-uploads` | `dyno-job-uploads-dev` |
| **MongoDB** | Production DB | Dev DB |
| **API URL** | `api.dynojob.com` | `api-dev.dynojob.com` |

## GitHub Actions Workflows

### Production Workflows
- `.github/workflows/deploy-api-production.yml`
- `.github/workflows/deploy-upload-consumer.yml`

### Dev Workflows
- `.github/workflows/deploy-api-dev.yml`
- `.github/workflows/deploy-upload-consumer-dev.yml`

**All workflows trigger on `main` branch**

## Deployment Flow

```bash
# 1. Make changes locally
git checkout main
# ... edit files ...

# 2. Commit and push
git add .
git commit -m "feat: new feature"
git push origin main

# 3. GitHub Actions triggers (automatically):
├─ deploy-api-production.yml ──▶ Render (dyno-job-api)
├─ deploy-api-dev.yml ─────────▶ Render (dyno-job-api-dev)
├─ deploy-upload-consumer.yml ─▶ CF Workers (production)
└─ deploy-upload-consumer-dev.yml ─▶ CF Workers (dev)

# 4. Both environments are live with the same code
```

## Testing Strategy

### Before Pushing to Main

**Local Testing:**
```bash
# Test API locally
pnpm --filter @lazyapply/api dev

# Test queue consumer locally
cd apps/upload-queue-consumer
pnpm dev

# Test extension locally
pnpm --filter @lazyapply/extension dev
```

### After Pushing to Main

**Dev Environment Testing:**
```bash
# Test dev API
curl https://dyno-job-api-dev.onrender.com/health

# Test dev queue consumer
wrangler tail --env dev

# Send test message to dev queue
wrangler queues producer parse-cv-dev send '{"test": true}'
```

**Production Verification:**
```bash
# Test production API
curl https://dyno-job-api.onrender.com/health

# Monitor production logs
wrangler tail
```

## When to Use This Strategy

### ✅ Good For:
- Small teams
- Rapid iteration
- Consistent environments
- Simple deployment pipeline
- Cost-conscious projects (no separate staging infrastructure)

### ❌ Not Ideal For:
- Large teams with complex approval processes
- Need for long-running feature branches
- Different code in staging vs production
- Strict change control requirements
- Gradual rollout strategies

## Alternative: Feature Branch Strategy

If you need more control, consider:

```
feature/new-feature → dev → staging → main
```

This would require:
1. Creating `dev` and `staging` branches
2. Updating workflows to trigger on respective branches
3. Setting up merge protection rules
4. Implementing PR review process

## Rollback Strategy

If something breaks in production:

### Option 1: Quick Fix
```bash
# Fix the issue
git add .
git commit -m "fix: critical bug"
git push origin main
# Both environments redeploy with fix
```

### Option 2: Git Revert
```bash
# Revert the problematic commit
git revert HEAD
git push origin main
# Both environments redeploy with reverted code
```

### Option 3: Cloudflare Rollback (Queue Consumer only)
```bash
# View deployment history
wrangler deployments list

# Rollback to previous version
wrangler rollback [deployment-id]

# For dev environment
wrangler rollback [deployment-id] --env dev
```

### Option 4: Render Rollback (API only)
1. Go to Render Dashboard
2. Select service (dyno-job-api or dyno-job-api-dev)
3. Go to "Deploys" tab
4. Click "Rollback" on previous successful deploy

## Monitoring Both Environments

### API Logs
```bash
# Production
render logs -s dyno-job-api

# Dev
render logs -s dyno-job-api-dev
```

### Queue Consumer Logs
```bash
# Production
wrangler tail

# Dev
wrangler tail --env dev
```

### Health Checks
```bash
# Production
curl https://dyno-job-api.onrender.com/health

# Dev
curl https://dyno-job-api-dev.onrender.com/health
```

## Cost Implications

With dual deployment from one branch:

**Render.com:**
- 2 services (prod + dev) = $14-50/month
- Both rebuild on every push

**Cloudflare Workers:**
- 2 environments share the same account limits
- Free tier: 100k requests/day (shared)
- Paid: $5/month (covers both)

**Optimization:**
- Use manual workflow triggers for dev if you don't need automatic deployment
- Pause dev service when not in use (Render allows this)
- Use Cloudflare's free tier for dev environment

## Summary

✅ **Current Setup**: Single `main` branch → Dual deployment (prod + dev)  
✅ **Separation**: By service names, environment flags, and resources  
✅ **Simplicity**: One branch, automatic deployment, consistent code  
✅ **Testing**: Dev environment for validation before production use  

This strategy prioritizes simplicity and speed over complex deployment gates, making it ideal for small teams and rapid development cycles.
