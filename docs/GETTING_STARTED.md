# Getting Started

## 1. Install

```bash
npm install -g pnpm@9
pnpm install
```

## 2. Setup Cloudflare (one-time)

```bash
wrangler login
wrangler queues create parse-cv-local
wrangler queues create parse-cv-dlq-local
wrangler r2 bucket create local
wrangler secret put WORKER_SECRET --env local
wrangler secret put OPENAI_API_KEY --env local
```

## 3. Copy env files

```bash
cp apps/api/.env.example apps/api/.env
cp apps/extension/.env.example apps/extension/.env
cp apps/upload-queue-consumer/.dev.vars.example apps/upload-queue-consumer/.dev.vars
```

Edit each file with your values.

## 4. Run

```bash
# Terminal 1: API
pnpm --filter @lazyapply/api dev

# Terminal 2: Worker (in apps/upload-queue-consumer)
pnpm wrangler dev --env local --remote

# Terminal 3: Extension
pnpm --filter @lazyapply/extension build
```

Load extension: Chrome → `chrome://extensions/` → Load unpacked → `apps/extension/dist`

## Verify

```bash
curl http://localhost:5050/api/health
curl http://localhost:8787/health
```

## Tests

```bash
pnpm test        # Unit tests
pnpm test:e2e    # E2E tests
```
