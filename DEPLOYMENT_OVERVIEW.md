# DynoJob Deployment Overview

Complete deployment setup for all DynoJob components with dev and production environments.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      DynoJob Platform                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐                                       │
│  │   Extension      │                                       │
│  │   (Chrome)       │                                       │
│  │   - React + TS   │                                       │
│  │   - Vite build   │                                       │
│  └────────┬─────────┘                                       │
│           │                                                 │
│           │ HTTP Requests                                   │
│           ▼                                                 │
│  ┌──────────────────────────────────────────┐              │
│  │   API (Node.js Express)                  │              │
│  │   Platform: Render/Railway/Fly.io        │              │
│  │   - REST endpoints                       │              │
│  │   - MongoDB connections                  │              │
│  │   - Background workers                   │              │
│  │   - R2 storage integration               │              │
│  └────────┬─────────────────────────────────┘              │
│           │                                                 │
│           │ Queue messages                                  │
│           ▼                                                 │
│  ┌──────────────────────────────────────────┐              │
│  │   Upload Queue Consumer                  │              │
│  │   Platform: Cloudflare Workers           │              │
│  │   - Processes CV parsing jobs            │              │
│  │   - Triggered by queue                   │              │
│  │   - Updates via API callback             │              │
│  └──────────────────────────────────────────┘              │
│                                                             │
│  ┌──────────────────┐                                       │
│  │   Functions      │                                       │
│  │   (Supabase)     │                                       │
│  │   - Edge funcs   │                                       │
│  └──────────────────┘                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Components & Deployment Targets

| Component | Platform | Production | Dev/Staging |
|-----------|----------|------------|-------------|
| **API** | Render/Railway/Fly.io | `main` branch → prod service | `main` branch → dev service |
| **Queue Consumer** | Cloudflare Workers | `main` branch → prod env | `main` branch → dev env |
| **Extension** | Chrome Web Store | Manual upload | Manual upload (unlisted) |
| **Functions** | Supabase | `main` branch | `main` branch |

## Quick Start

### 1. Upload Queue Consumer (Cloudflare Workers)

**Status:** ✅ Configured

**Files:**
- `apps/upload-queue-consumer/wrangler.toml` - CF Workers config with dev environment
- `.github/workflows/deploy-upload-consumer.yml` - Production deployment
- `.github/workflows/deploy-upload-consumer-dev.yml` - Dev deployment

**Setup:**
```bash
# Create Cloudflare resources
wrangler queues create parse-cv
wrangler queues create parse-cv-dlq
wrangler queues create parse-cv-dev
wrangler queues create parse-cv-dlq-dev
wrangler r2 bucket create dyno-job-uploads
wrangler r2 bucket create dyno-job-uploads-dev

# Set GitHub secrets
CLOUDFLARE_API_TOKEN
API_URL, DEV_API_URL
MONGO_CONNECTION, DEV_MONGO_CONNECTION
R2_BUCKET_NAME, DEV_R2_BUCKET_NAME
R2_ACCESS_KEY_ID, DEV_R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY, DEV_R2_SECRET_ACCESS_KEY
R2_ENDPOINT, DEV_R2_ENDPOINT
```

**Deploy:**
- Push to `main` → Both production and dev environments

**Docs:** `apps/upload-queue-consumer/DEV_SETUP.md`

---

### 2. API (Node.js Express)

**Status:** ✅ Configured

**Files:**
- `render.yaml` - Render.com configuration (both prod and dev)
- `.github/workflows/deploy-api-production.yml` - Production deployment
- `.github/workflows/deploy-api-dev.yml` - Dev deployment
- `apps/api/DEPLOYMENT.md` - Full deployment guide

**Setup:**

**Option A: Render.com (Recommended)**
1. Connect GitHub repo to Render
2. Render will auto-detect `render.yaml`
3. Set environment variables in Render dashboard
4. Deploy automatically on push

**Option B: Railway.app**
1. Install Railway CLI: `npm i -g @railway/cli`
2. `railway login`
3. `railway init`
4. Set environment variables
5. `railway up`

**Option C: Fly.io**
1. Install Fly CLI: `brew install flyctl`
2. `fly auth login`
3. `fly launch`
4. Set secrets: `fly secrets set KEY=value`
5. `fly deploy`

**Environment Variables:**
```bash
# Production
NODE_ENV=production
MONGO_CONNECTION=mongodb+srv://...
JWT_SECRET=...
ALLOWED_ORIGIN_LIST=https://app.dynojob.com
R2_BUCKET_NAME=dyno-job-uploads
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ENDPOINT=https://...

# Dev (same keys, different values)
NODE_ENV=development
MONGO_CONNECTION=mongodb+srv://...-dev
R2_BUCKET_NAME=dyno-job-uploads-dev
...
```

**Deploy:**
- Push to `main` → Both production and dev services

**Health Check:** `/health` endpoint already exists

**Docs:** `apps/api/DEPLOYMENT.md`, `apps/api/CLOUDFLARE_DEPLOYMENT.md`

---

### 3. Extension (Chrome)

**Status:** ⚠️ Manual deployment

**Files:**
- `apps/extension/` - Chrome extension source

**Build:**
```bash
cd apps/extension
pnpm build        # Creates dist/
pnpm zip          # Creates extension.zip
```

**Deploy:**

**Production:**
1. Build: `pnpm zip`
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Upload `extension.zip`
4. Submit for review

**Dev/Testing:**
1. Build: `pnpm build`
2. Chrome → Extensions → Load unpacked
3. Select `apps/extension/dist/`

**Docs:** `apps/extension/README.md`

---

### 4. Functions (Supabase)

**Status:** ⚠️ Manual deployment

**Files:**
- `apps/functions/` - Supabase Edge Functions

**Deploy:**
```bash
cd apps/functions

# Production
supabase functions deploy

# Dev (if you have separate Supabase projects)
supabase link --project-ref <dev-project-ref>
supabase functions deploy
```

**Docs:** `apps/functions/README.md`

---

## Environment Setup Checklist

### Cloudflare (Queue Consumer)

- [ ] Create Cloudflare account
- [ ] Get API token
- [ ] Create queues (prod and dev)
- [ ] Create R2 buckets (prod and dev)
- [ ] Set GitHub secrets:
  - [ ] `CLOUDFLARE_API_TOKEN`
  - [ ] `API_URL` and `DEV_API_URL`
  - [ ] `MONGO_CONNECTION` and `DEV_MONGO_CONNECTION`
  - [ ] R2 credentials (prod and dev)

### Node.js Platform (API)

**Choose one: Render / Railway / Fly.io**

- [ ] Create account
- [ ] Connect GitHub repo
- [ ] Create production service
- [ ] Create dev service
- [ ] Set environment variables (both environments)
- [ ] Configure deploy hooks (optional)
- [ ] Set GitHub secrets:
  - [ ] `RENDER_DEPLOY_HOOK_URL` (if using Render)
  - [ ] `RENDER_DEPLOY_HOOK_URL_DEV`

### Chrome Web Store (Extension)

- [ ] Create developer account ($5 one-time fee)
- [ ] Create extension listing
- [ ] Upload initial version
- [ ] Configure OAuth (if needed)

### Supabase (Functions)

- [ ] Create Supabase project (production)
- [ ] Create Supabase project (dev) - optional
- [ ] Install Supabase CLI
- [ ] Link projects
- [ ] Set function secrets

---

## Deployment Workflows

### Deployment Workflow

```bash
# 1. Make changes
git checkout main
# ... make changes ...

# 2. Commit and push
git add .
git commit -m "feat: new feature"
git push origin main

# 3. Automatic deployments trigger (BOTH environments):
# - API → Render/Railway/Fly.io (production AND dev services)
# - Queue Consumer → Cloudflare Workers (production AND dev environments)

# 4. Manual deployments:
# - Extension → Chrome Web Store (manual upload)
# - Functions → Supabase (manual or CI/CD)
```

**Note:** Both production and dev environments deploy from the same `main` branch. They are differentiated by:
- **API**: Separate Render services (`dyno-job-api` vs `dyno-job-api-dev`)
- **Queue Consumer**: Separate CF Workers environments (default vs `--env dev`)
- **Configuration**: Different environment variables and resources (queues, buckets, databases)

---

## Monitoring & Logs

### API
```bash
# Render
render logs -s dyno-job-api

# Railway
railway logs

# Fly.io
flyctl logs
```

### Queue Consumer
```bash
# Production
wrangler tail

# Dev
wrangler tail --env dev
```

### Extension
- Chrome DevTools Console
- `chrome://extensions` → Inspect views

### Functions
```bash
supabase functions logs <function-name>
```

---

## Troubleshooting

### API Not Deploying
1. Check GitHub Actions logs
2. Verify environment variables are set
3. Test build locally: `pnpm --filter @lazyapply/api build`
4. Check platform-specific logs

### Queue Consumer Not Working
1. Check Cloudflare Workers logs: `wrangler tail`
2. Verify queues exist: `wrangler queues list`
3. Verify secrets: `wrangler secret list`
4. Test locally: `pnpm dev`

### Extension Not Loading
1. Check manifest.json is valid
2. Verify build output in `dist/`
3. Check Chrome console for errors
4. Rebuild: `pnpm build`

### Functions Failing
1. Check Supabase logs
2. Verify environment variables
3. Test locally: `supabase functions serve`

---

## Cost Estimates

| Service | Free Tier | Paid (Small App) |
|---------|-----------|------------------|
| **Render** | 750 hrs/month | $7-25/month |
| **Railway** | $5 credit | $10-20/month |
| **Fly.io** | 3 VMs | $5-10/month |
| **Cloudflare Workers** | 100k req/day | $5/month |
| **Supabase** | 500MB DB, 2GB storage | $25/month |
| **Chrome Web Store** | $5 one-time | - |
| **MongoDB Atlas** | 512MB | $9/month |
| **Total** | ~$5-10/month | ~$50-100/month |

---

## Next Steps

1. **Choose API hosting platform** (Render recommended for simplicity)
2. **Set up Cloudflare account** for queue consumer
3. **Configure GitHub secrets** for CI/CD
4. **Push to main** to deploy both environments
5. **Test dev environment** first
6. **Verify production** is working
7. **Set up monitoring** and alerts

---

## Support

- **API Issues:** See `apps/api/DEPLOYMENT.md`
- **Queue Consumer Issues:** See `apps/upload-queue-consumer/DEV_SETUP.md`
- **General Questions:** Check individual README files in each app directory
