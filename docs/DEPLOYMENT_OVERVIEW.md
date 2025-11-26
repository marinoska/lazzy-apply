# LazyApply Deployment Overview

Complete deployment setup for all LazyApply components with dev and production environments.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     LazyApply Platform                      │
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
│  │   Platform: Render                       │              │
│  │   - REST endpoints                       │              │
│  │   - MongoDB connections                  │              │
│  │   - User authentication (Supabase)       │              │
│  │   - Worker authentication                │              │
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
| **API** | Render | `main` branch → manual prod | `main` branch → auto dev |
| **Queue Consumer** | Cloudflare Workers | Manual workflow dispatch | `main` branch → dev env (auto) |
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
wrangler r2 bucket create lazyapply-uploads
wrangler r2 bucket create lazyapply-uploads-dev

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
- Push to `main` → Deploys **dev** worker via `deploy-upload-consumer-dev.yml`
- GitHub Actions → Run `Deploy Upload Queue Consumer (Prod)` manually for production

**Docs:** `apps/upload-queue-consumer/SETUP.md`

---

### 2. API (Node.js Express)

**Status:** ✅ Configured

**Files:**
- `apps/api/DEPLOYMENT.md` - Full deployment guide
- `docs/RENDER_SETUP.md` - Render setup walkthrough
- `render.yaml` - Create from the template in `apps/api/DEPLOYMENT.md` (not tracked in repo)

**Setup:**

**Option A: Render.com (Recommended)**
1. Connect GitHub repo to Render
2. Render will auto-detect `render.yaml`
3. Set environment variables in Render dashboard
4. Dev deploys automatically on push to `main`
5. Production deploys manually via dashboard or deploy hook

**See `RENDER_SETUP.md` for detailed setup instructions**

**Environment Variables:**
```bash
# Production
NODE_ENV=production
MONGO_CONNECTION=mongodb+srv://...
ALLOWED_ORIGINS=https://app.lazyapply.com,https://lazyapply.com
SUPABASE_JWT_SECRET=...
SUPABASE_JWKS_URL=https://...
WORKER_SECRET=...

# Dev (same keys, different values)
NODE_ENV=development
MONGO_CONNECTION=mongodb+srv://...-dev
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
...
```

**Deploy:**
- Push to `main` → Dev auto-deploys, Production manual

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

**Docs:** Source in `apps/extension/` (no dedicated README yet)

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

# 3. Automatic deployments trigger:
# - API Dev → Render (auto-deploy)
# - Queue Consumer → Cloudflare Workers (dev only via GH Actions)
# - API Production → Manual deploy required
# - Queue Consumer Prod → Manual workflow dispatch

# 4. Manual deployments:
# - Extension → Chrome Web Store (manual upload)
# - Functions → Supabase (manual or CI/CD)
# - Queue Consumer Prod → GitHub Actions workflow dispatch
# - API Prod → Render dashboard or deploy hook
```

**Note:** Both production and dev environments deploy from the same `main` branch. They are differentiated by:
- **API**: Separate Render services (`lazyapply-api` vs `lazyapply-api-dev`)
- **Queue Consumer**: Separate CF Workers environments (default vs `--env dev`)
- **Configuration**: Different environment variables and resources (queues, buckets, databases)

---

## Monitoring & Logs

### API
```bash
# Render
render logs -s lazyapply-api        # Production
render logs -s lazyapply-api-dev    # Dev
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
1. Check Render build/service logs
2. Verify environment variables are set
3. Test build locally: `pnpm --filter @lazyapply/api build`
4. If using CI, review workflow logs

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
| **Render** | 750 hrs/month | $14/month (2 services) |
| **Cloudflare Workers** | 100k req/day | $5/month |
| **Supabase** | 500MB DB, 2GB storage | $25/month |
| **Chrome Web Store** | $5 one-time | - |
| **MongoDB Atlas** | 512MB | $9/month |
| **Total** | ~$5/month | ~$50-60/month |

---

## Next Steps

1. **Set up Render** using `RENDER_SETUP.md`
2. **Set up Cloudflare account** for queue consumer
3. **Configure environment variables** in Render dashboard
4. **Push to main** to auto-deploy dev environment
5. **Test dev environment** thoroughly
6. **Manually deploy production** when ready
7. **Set up monitoring** and alerts

---

## Support

- **API Issues:** See `apps/api/DEPLOYMENT.md`
- **Queue Consumer Issues:** See `apps/upload-queue-consumer/SETUP.md`
- **General Questions:** Check individual README files in each app directory
