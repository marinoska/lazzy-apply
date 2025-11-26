# Render Setup Guide

Complete guide to deploy both production and dev environments on Render.

## Overview

- **Production** (`lazyapply-api`): Manual deploy only
- **Dev** (`lazyapply-api-dev`): Auto-deploy on push to `main`
- `render.yaml` is not checked in—generate it from the template in `apps/api/DEPLOYMENT.md` before applying the blueprint.

## Prerequisites

1. [Render account](https://render.com) (free tier available)
2. GitHub repository connected to Render
3. MongoDB connection strings (prod and dev)
4. Supabase credentials for authentication

## Step 1: Connect GitHub Repository

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub account if not already connected
4. Select your repository
5. Render will detect `render.yaml` automatically

## Step 2: Review Blueprint

Render will show you the services defined in `render.yaml`:

- ✅ `lazyapply-api` (Production)
- ✅ `lazyapply-api-dev` (Dev)

Click **"Apply"** to create both services.

## Step 3: Configure Environment Variables

### Production Service (`lazyapply-api`)

Go to the service → **Environment** tab and add env vars from .env

### Dev Service (`lazyapply-api-dev`)

Go to the service → **Environment** tab and add:

```bash
# Already set in render.yaml
NODE_ENV=development
PORT=8080
HOST=0.0.0.0

# You need to add these manually:
MONGO_CONNECTION=mongodb+srv://user:pass@cluster.mongodb.net/lazyapply-dev
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
SUPABASE_JWKS_URL=https://your-project.supabase.co/.well-known/jwks.json
WORKER_SECRET=your-worker-secret-here
```

## Step 4: Initial Deploy

### Dev Environment (Auto-deploys)
- Already configured with `autoDeploy: true`
- Will automatically deploy when you push to `main`
- First deploy: Click **"Manual Deploy"** → **"Deploy latest commit"**

### Production Environment (Manual only)
- Configured with `autoDeploy: false`
- Deploy manually via:
  - **Render Dashboard**: Click **"Manual Deploy"** → **"Deploy latest commit"**
  - **Deploy Hook**: Use the webhook URL (see below)

## Step 5: Get Deploy Hook URLs (Optional)

For production manual deploys via API/CI:

1. Go to `lazyapply-api` service → **Settings**
2. Scroll to **"Deploy Hook"**
3. Copy the URL
4. Save it as a GitHub secret: `RENDER_DEPLOY_HOOK_URL`

For dev (if you want to trigger manually sometimes):

1. Go to `lazyapply-api-dev` service → **Settings**
2. Copy the Deploy Hook URL
3. Save it as a GitHub secret: `RENDER_DEPLOY_HOOK_URL_DEV`

## Deployment Workflow

### Automatic (Dev Only)

```bash
# Make changes
git add .
git commit -m "feat: new feature"
git push origin main

# Dev environment automatically deploys
# Production stays unchanged
```

### Manual (Production)

**Option 1: Render Dashboard**
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select `lazyapply-api`
3. Click **"Manual Deploy"** → **"Deploy latest commit"**

**Option 2: Deploy Hook**
```bash
curl -X POST "https://api.render.com/deploy/srv-xxxxx?key=xxxxx"
```

**Option 3: GitHub Actions**
Use the existing workflow (manual trigger):
```bash
# Go to GitHub → Actions → "Deploy API (Production)" → Run workflow
```

## Verify Deployments

### Health Checks

```bash
# Production
curl https://lazyapply-api.onrender.com/health

# Dev
curl https://lazyapply-api-dev.onrender.com/health
```

### View Logs

```bash
# Install Render CLI (optional)
npm install -g render

# View logs
render logs -s lazyapply-api        # Production
render logs -s lazyapply-api-dev    # Dev
```

Or view logs in the Render Dashboard → Service → **Logs** tab.

## Service URLs

After deployment, your services will be available at:

- **Production**: `https://lazyapply-api.onrender.com`
- **Dev**: `https://lazyapply-api-dev.onrender.com`

You can also add custom domains in Render Dashboard → Service → **Settings** → **Custom Domain**.

## Troubleshooting

### Build Fails

1. Check the build logs in Render Dashboard
2. Verify all environment variables are set
3. Test build locally:
   ```bash
   pnpm install
   pnpm --filter @lazyapply/api build
   ```

### Service Won't Start

1. Check the service logs
2. Verify `startCommand` is correct
3. Ensure `PORT` and `HOST` are set correctly
4. Check MongoDB connection string

### Environment Variables Not Working

1. Render requires you to manually add secrets (those with `sync: false`)
2. Go to Service → **Environment** → Add each variable
3. Redeploy after adding variables

### Dev Not Auto-Deploying

1. Verify `autoDeploy: true` in `render.yaml`
2. Check GitHub connection in Render Dashboard
3. Ensure you're pushing to the `main` branch
4. Check Render Dashboard → Service → **Events** for deploy triggers

## Cost

- **Free Tier**: 750 hours/month (enough for 1 service running 24/7)
- **Starter Plan**: $7/month per service
- **For 2 services**: $14/month total

**Tip**: You can suspend the dev service when not in use to save costs.

## Next Steps

1. ✅ Create both services on Render
2. ✅ Configure environment variables
3. ✅ Deploy dev environment (auto)
4. ✅ Test dev environment
5. ✅ Manually deploy production
6. ✅ Test production environment
7. ✅ Update your extension/frontend to use the new API URLs

## Support

- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com)
- Check service logs for errors
