# LazyApply Monorepo

A Turborepo monorepo for the LazyApply platform, containing the browser extension and Supabase Edge Functions.

## Structure

```
LazyApply/
├── apps/
│   ├── extension/          # LazyApplyAgent Chrome Extension
│   └── functions/          # Supabase Edge Functions
├── packages/
│   ├── types/             # Shared TypeScript types
│   ├── schemas/           # Shared Zod validation schemas
│   ├── utils/             # Shared utility functions
│   └── config/            # Shared configs (tsconfig, biome)
├── package.json           # Root package.json with workspaces
├── turbo.json            # Turborepo configuration
└── pnpm-workspace.yaml   # PNPM workspace configuration
```

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 9.0.0

### Installation

```bash
# Install dependencies for all workspaces
pnpm install
```

### Development

```bash
# Run all apps in development mode
pnpm dev

# Run specific app
pnpm --filter @lazyapply/extension dev
pnpm --filter @lazyapply/functions dev

# Build all apps
pnpm build

# Lint all packages
pnpm lint

# Format code
pnpm format
```

## Apps

### Extension (`apps/extension`)

Chrome extension built with React, TypeScript, and Vite.

**Features:**
- React 19 with TypeScript
- Vite for fast development
- MUI Joy for UI components
- Supabase integration
- Chrome Extension Manifest V3

**Commands:**
```bash
cd apps/extension
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm zip          # Create extension zip
```

### Functions (`apps/functions`)

Supabase Edge Functions for backend logic.

**Commands:**
```bash
cd apps/functions
pnpm dev          # Start local Supabase
pnpm deploy       # Deploy to Supabase
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

Create `.env` files in each app directory:

```bash
# apps/extension/.env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# apps/functions/.env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## License

MIT
