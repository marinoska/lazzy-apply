# LazyApply Monorepo

Turborepo workspace for the LazyApply platform: Chrome extension, API, Supabase Edge Functions, and the Cloudflare upload queue worker.

## Structure

```
DynoJob/
├── apps/
│   ├── extension/               # Chrome Extension (React + Vite)
│   ├── api/                     # REST API (Express + MongoDB)
│   ├── functions/               # Supabase Edge Functions
│   └── upload-queue-consumer/   # Cloudflare Worker for CV parsing
├── packages/
│   ├── types/                  # Shared TypeScript types
│   ├── schemas/                # Shared Zod validation schemas
│   ├── utils/                  # Shared utility functions
│   └── config/                 # Shared configs (tsconfig, biome)
├── package.json                # Root workspace scripts
├── turbo.json                  # Turborepo task config
└── pnpm-workspace.yaml         # PNPM workspace configuration
```

## Getting Started

### Prerequisites

- Node.js >= 22
- pnpm >= 9.0.0

### Installation

```bash
# Install dependencies for all workspaces
pnpm install
```

### Development

```bash
# Run all apps in development mode (Turbo)
pnpm dev

# Run a specific app
pnpm --filter @lazyapply/extension dev       # Extension
pnpm --filter @lazyapply/api dev             # API
pnpm --filter @lazyapply/functions dev       # Supabase functions
pnpm --filter @lazyapply/upload-queue-consumer dev  # Cloudflare worker (dev env)

# Build all apps and packages
pnpm build

# Lint everything
pnpm lint

# Format code
pnpm format
```

## Apps

### Extension (`apps/extension`)

Chrome extension built with React, TypeScript, and Vite (Manifest V3).

**Features:**
- React 19 with TypeScript
- Vite for fast development
- MUI Joy for UI components
- Supabase integration
- Chrome Extension Manifest V3 (build output in `dist/`)

**Commands:**
```bash
cd apps/extension
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm zip          # Create extension zip
```

### API (`apps/api`)

Express API with MongoDB and Supabase JWT verification.

**Commands:**
```bash
cd apps/api
pnpm dev          # Start in watch mode (requires env vars)
pnpm build        # TypeScript build
pnpm test         # Unit tests
```

### Functions (`apps/functions`)

Supabase Edge Functions for backend logic.

**Commands:**
```bash
cd apps/functions
pnpm dev          # Start local Supabase
pnpm deploy       # Deploy to Supabase
```

### Upload Queue Consumer (`apps/upload-queue-consumer`)

Cloudflare Worker that consumes CV parsing jobs from Cloudflare Queues and writes to R2.

**Commands:**
```bash
cd apps/upload-queue-consumer
pnpm dev       # Run against dev queue/bucket (wrangler dev --env dev)
pnpm deploy    # Deploy to Cloudflare (prod by default)
pnpm tail      # Stream logs
```

## Packages

### `@lazyapply/types`
Shared TypeScript type definitions used across the monorepo.

### `@lazyapply/schemas`
Zod validation schemas for runtime type checking.

### `@lazyapply/utils`
Common utility functions shared between apps.

### `@lazyapply/config`
Shared configuration files (TypeScript, Biome) for consistent tooling.

## Turborepo

This monorepo uses [Turborepo](https://turbo.build/repo) for:
- Fast, incremental builds
- Smart caching
- Parallel task execution
- Dependency graph management

### Key Commands

```bash
pnpm build        # Build all apps and packages
pnpm dev          # Run all apps in dev mode
pnpm lint         # Lint all packages
pnpm clean        # Clean all build artifacts
```

## Adding a New Package

1. Create a new directory in `packages/`
2. Add `package.json` with name `@lazyapply/<name>`
3. Add to workspace in `pnpm-workspace.yaml` (already configured with `packages/*`)
4. Reference in consuming apps using `"@lazyapply/<name>": "workspace:*"`

## Adding a New App

1. Create a new directory in `apps/`
2. Add `package.json` with name `@lazyapply/<name>`
3. Add to workspace in `pnpm-workspace.yaml` (already configured with `apps/*`)
4. Configure build scripts in `turbo.json` if needed

## Environment Variables

Create `.env` files in each app directory as needed:

```bash
# apps/extension/.env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# apps/api/.env
NODE_ENV=development
HOST=0.0.0.0
PORT=3000
MONGO_CONNECTION=your_mongodb_url
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
SUPABASE_JWT_SECRET=optional_supabase_jwt_secret
SUPABASE_JWKS_URL=optional_supabase_jwks_url
WORKER_SECRET=shared_secret_for_worker_calls

# apps/functions/.env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

The Cloudflare worker (`apps/upload-queue-consumer`) uses `wrangler secret put` for secrets; see its `wrangler.toml` for variable names.

## Documentation

- Developer guides and deployment notes live in `docs/` (start with `docs/GETTING_STARTED.md` and `docs/DEPLOYMENT_OVERVIEW.md`).
- API deployment details are in `apps/api/DEPLOYMENT.md`.
- Queue worker deployment: `apps/upload-queue-consumer/wrangler.toml` and GitHub Actions under `.github/workflows/`.

## License

MIT
