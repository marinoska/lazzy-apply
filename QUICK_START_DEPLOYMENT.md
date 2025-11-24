# Quick Start: Dev Environment Deployment

Get your dev environment up and running in 15 minutes.

## Prerequisites

- [ ] GitHub account
- [ ] Cloudflare account (free tier OK)
- [ ] Render.com account (or Railway/Fly.io)
- [ ] MongoDB Atlas account (free tier OK)

## Step 1: Cloudflare Setup (5 min)

### 1.1 Get API Token
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Create Token → Edit Cloudflare Workers template
3. Copy the token

### 1.2 Create Resources
```bash
# Install wrangler if needed
npm install -g wrangler

# Login
wrangler login

# Create queues
wrangler queues create parse-cv-dev
wrangler queues create parse-cv-dlq-dev

# Create R2 bucket
wrangler r2 bucket create lazy-job-uploads-dev
```

## Step 2: Render.com Setup (5 min)

### 2.1 Connect GitHub
1. Go to https://render.com
2. Sign up / Login
3. New → Web Service
4. Connect your GitHub repo
5. Render will detect `render.yaml`

### 2.2 Configure Dev Service
1. Select `lazy-job-api-dev` service
2. Set branch to `dev`
3. Add environment variables:
   ```
   NODE_ENV=development
   MONGO_CONNECTION=<your-dev-mongodb-url>
   JWT_SECRET=<random-secret>
   ALLOWED_ORIGIN_LIST=http://localhost:3000
   R2_BUCKET_NAME=lazy-job-uploads-dev
   R2_ACCESS_KEY_ID=<your-r2-key>
   R2_SECRET_ACCESS_KEY=<your-r2-secret>
   R2_ENDPOINT=<your-r2-endpoint>
   ```

## Step 3: GitHub Secrets (3 min)

Go to GitHub repo → Settings → Secrets and variables → Actions

Add these secrets:

### Cloudflare Secrets
```
CLOUDFLARE_API_TOKEN=<from-step-1.1>
DEV_API_URL=<your-render-dev-url>
DEV_MONGO_CONNECTION=<your-dev-mongodb-url>
DEV_R2_BUCKET_NAME=lazy-job-uploads-dev
DEV_R2_ACCESS_KEY_ID=<your-r2-key>
DEV_R2_SECRET_ACCESS_KEY=<your-r2-secret>
DEV_R2_ENDPOINT=<your-r2-endpoint>
```

### Render Secrets (Optional - for manual triggers)
```
RENDER_DEPLOY_HOOK_URL_DEV=<from-render-dashboard>
```

## Step 4: Deploy! (1 min)

```bash
# Make a small change to trigger deployment
git checkout main
echo "# Deployment setup complete" >> README.md
git add .
git commit -m "chore: trigger deployment"
git push origin main
```

This will trigger deployment to **BOTH** environments:
- ✅ API deployment to Render (production AND dev services)
- ✅ Queue Consumer deployment to Cloudflare Workers (production AND dev environments)

## Step 5: Verify (2 min)

### Check API
```bash
# Get your Render dev URL from dashboard
curl https://lazy-job-api-dev.onrender.com/health
# Should return: {"status":"ok"}
```

### Check Queue Consumer
```bash
# View Cloudflare Workers logs
wrangler tail --env dev

# Send test message
wrangler queues producer parse-cv-dev send '{"fileId":"test","logId":"test","userId":"test"}'
```

## Done! 🎉

Both environments are now live from the same `main` branch:

**Production:**
- **API**: `https://lazy-job-api.onrender.com`
- **Queue Consumer**: Running on Cloudflare Workers (production)

**Dev:**
- **API**: `https://lazy-job-api-dev.onrender.com`
- **Queue Consumer**: Running on Cloudflare Workers (dev environment)

## What's Next?

### Local Development
```bash
# Install dependencies
pnpm install

# Run API locally
pnpm --filter @lazyapply/api dev

# Run queue consumer locally
cd apps/upload-queue-consumer
pnpm dev

# Run extension locally
pnpm --filter @lazyapply/extension dev
```

### Deploy Updates

Any push to `main` will deploy to **both** production and dev:

```bash
git checkout main
# ... make changes ...
git add .
git commit -m "feat: your changes"
git push origin main
```

Both environments deploy simultaneously:
- Production uses production resources (queues, buckets, DB)
- Dev uses dev resources (queues with `-dev` suffix, separate buckets, dev DB)

## Troubleshooting

### API Not Responding
- Check Render logs: Dashboard → lazy-job-api-dev → Logs
- Verify environment variables are set
- Check MongoDB connection string

### Queue Consumer Not Working
- Check Cloudflare logs: `wrangler tail --env dev`
- Verify queues exist: `wrangler queues list`
- Check secrets: `wrangler secret list --env dev`

### GitHub Actions Failing
- Check Actions tab in GitHub
- Verify all secrets are set correctly
- Check workflow logs for specific errors

## Common Issues

**Issue:** MongoDB connection timeout
**Fix:** Add `0.0.0.0/0` to MongoDB Atlas IP whitelist

**Issue:** R2 access denied
**Fix:** Verify R2 credentials and bucket permissions

**Issue:** Render build fails
**Fix:** Check that `pnpm-lock.yaml` is committed

**Issue:** Queue not receiving messages
**Fix:** Verify queue names match in wrangler.toml and code

## Support

- **Full Documentation**: See `DEPLOYMENT_OVERVIEW.md`
- **API Details**: See `apps/api/DEPLOYMENT.md`
- **Queue Consumer**: See `apps/upload-queue-consumer/DEV_SETUP.md`
