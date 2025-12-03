# Security Considerations

This document consolidates security measures and approaches across the LazyApply platform.

## Authentication Layers

### 1. User Authentication (Supabase JWT)

**Used by:** Chrome Extension → API

- Users authenticate via Supabase (email/password, OAuth)
- JWT tokens are verified using JWKS (JSON Web Key Set)
- Tokens are stored in extension's `chrome.storage.local`
- API validates tokens via `authenticateUser` middleware

**Files:**
- `apps/api/src/app/middleware/authenticateUser.ts`
- `apps/extension/src/background/auth.ts`

### 2. Worker Authentication (WORKER_SECRET)

**Used by:** Edge Worker → API

- Shared secret between Cloudflare Worker and API
- Sent via `X-Worker-Secret` header
- Used for internal service-to-service calls

**Files:**
- `apps/api/src/app/middleware/authenticateWorker.ts`
- `apps/upload-queue-consumer/src/lib/uploadHandler.ts`

**Environment:**
- Worker: `WORKER_SECRET` (via `wrangler secret put`)
- API: `WORKER_SECRET` (in `.env`)

### 3. Extension Authentication (EXTENSION_SECRET)

**Used by:** Chrome Extension → Edge Worker (upload endpoint)

- Shared secret between extension and upload worker
- Sent via `X-Extension-Key` header
- Prevents unauthorized access to upload endpoint

**⚠️ CRITICAL SECURITY RULE:**
`VITE_EXTENSION_SECRET` must **ONLY** be used in the background script (`src/background/`).
Background scripts run in an isolated context that is inaccessible to web pages.
**Never** import or use this secret in:
- Content scripts
- UI components (popup, sidepanel)
- Any script that runs in the page context

**Files:**
- `apps/extension/src/background/messageHandler.ts` (only place it should be used)
- `apps/upload-queue-consumer/src/lib/uploadHandler.ts`

**Environment:**
- Extension: `VITE_EXTENSION_SECRET` (in `.env`, background script only)
- Worker: `EXTENSION_SECRET` (via `wrangler secret put`)

## API Route Protection

### Worker-Authenticated Routes (`/worker/*`)
Internal endpoints called by Cloudflare Workers only:
- `POST /worker/uploads/init` - Initialize upload (phase 1)
- `POST /worker/uploads/finalize` - Finalize upload (phase 2)
- `GET /worker/uploads/:fileId/raw-text` - Fetch raw text for parsing
- `PATCH /worker/outbox/:processId` - Update outbox processing status

### User-Authenticated Routes (`/api/*`)
Endpoints called by Chrome Extension (user context):
- `GET /api/uploads` - List user's uploads
- `DELETE /api/uploads/:fileId` - Delete upload
- `POST /api/autofill` - Classify form fields

### Public Routes (`/api/*`)
- `GET /api/health` - Health check

## Data Protection

### File Upload Validation
- **Max file size:** 5MB (`MAXIMUM_UPLOAD_SIZE_BYTES`)
- **Max raw text size:** 80KB (`MAXIMUM_RAW_TEXT_BYTES`)
- **Allowed types:** PDF, DOCX only
- Validation happens at the edge before storage

### File Storage (R2)
- Files stored in Cloudflare R2 with UUID-based keys
- No public access to bucket
- Files accessed only via authenticated worker

### Database (MongoDB)
- User data isolated by `userId` field
- Ownership enforced on all queries
- Sensitive data (raw CV text) stored server-side only

## Secret Management

### Production Secrets

| Secret | Location | Set Via |
|--------|----------|---------|
| `WORKER_SECRET` | API, Worker | `.env`, `wrangler secret put` |
| `EXTENSION_SECRET` | Extension, Worker | `.env`, `wrangler secret put` |
| `OPENAI_API_KEY` | Worker | `wrangler secret put` |
| `AXIOM_API_TOKEN` | Worker | `wrangler secret put` |
| `SUPABASE_ANON_KEY` | Extension | `.env` (public key, safe to expose) |
| `MONGODB_URI` | API | `.env` |

### Local Development
- Use `.env` / `.dev.vars` files (gitignored)
- Copy from `.env.example` / `.dev.vars.example`
- Never commit actual secrets

## Best Practices

1. **Rotate secrets regularly** - Especially after team member changes
2. **Use environment-specific secrets** - Different values for dev/prod
3. **Audit secret usage** - Grep codebase for secret names periodically
4. **Minimize secret exposure** - Only load secrets where needed
5. **Log security events** - Failed auth attempts, rejected uploads
6. **Validate all inputs** - Use Zod schemas for request validation

## Incident Response

If a secret is compromised:

1. **Rotate immediately** via respective platform (Cloudflare, Supabase, etc.)
2. **Update all environments** (dev, prod)
3. **Review logs** for unauthorized access
4. **Notify affected users** if user data was exposed
