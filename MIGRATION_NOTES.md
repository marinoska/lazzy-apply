# Migration to Turborepo - Notes

This document outlines the changes made during the migration to a Turborepo monorepo structure.

## What Changed

### Structure

**Before:**
```
DynoJob/
├── src/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── ...
```

**After:**
```
DynoJob/
├── apps/
│   ├── extension/          # Moved from root
│   │   ├── src/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   └── functions/          # New
│       ├── functions/
│       ├── supabase/
│       └── package.json
├── packages/
│   ├── types/             # New - shared types
│   ├── schemas/           # New - Zod schemas
│   ├── utils/             # New - shared utilities
│   └── config/            # New - shared configs
├── package.json           # Root workspace config
├── turbo.json            # Turborepo config
└── pnpm-workspace.yaml   # Workspace definition
```

### Files Moved

- `src/` → `apps/extension/src/`
- `tsconfig.json` → `apps/extension/tsconfig.json`
- `vite.config.ts` → `apps/extension/vite.config.ts`

### New Files Created

**Root:**
- `turbo.json` - Turborepo task configuration
- `pnpm-workspace.yaml` - Workspace definition
- `GETTING_STARTED.md` - Developer onboarding guide
- `MIGRATION_NOTES.md` - This file

**Apps:**
- `apps/extension/package.json` - Extension workspace package
- `apps/functions/` - Complete Supabase Edge Functions setup

**Packages:**
- `packages/types/` - Shared TypeScript types
- `packages/schemas/` - Shared Zod validation schemas
- `packages/utils/` - Shared utility functions
- `packages/config/` - Shared configuration files

### Package.json Changes

**Root package.json:**
- Added `workspaces` field
- Added `turbo` as devDependency
- Changed scripts to use Turborepo
- Removed app-specific dependencies

**Extension package.json:**
- Added workspace dependencies: `@lazyapply/types`, `@lazyapply/utils`, `@lazyapply/config`
- Kept all original dependencies

### TypeScript Configuration

**Extension tsconfig.json:**
- Now extends `@lazyapply/config/tsconfig.json`
- Added `paths` for workspace packages
- Simplified by inheriting common config

**Shared config:**
- Created `packages/config/tsconfig.json` with base configuration
- All apps can extend this for consistency

## Breaking Changes

### Import Paths

If you were importing from relative paths that crossed workspace boundaries, you'll need to update them:

**Before:**
```typescript
// Not applicable - was single package
```

**After:**
```typescript
// Use workspace packages
import { User } from '@lazyapply/types';
import { formatDate } from '@lazyapply/utils';
```

### Build Commands

**Before:**
```bash
npm run build
npm run dev
```

**After:**
```bash
# From root - builds all
pnpm build
pnpm dev

# For specific app
pnpm --filter @lazyapply/extension build
pnpm --filter @lazyapply/extension dev
```

### Environment Variables

No changes to environment variable structure, but they should now be placed in:
- `apps/extension/.env` (not root)
- `apps/functions/.env`

## Benefits

1. **Code Sharing**: Shared packages eliminate duplication between extension and functions
2. **Type Safety**: Shared types ensure consistency across the stack
3. **Build Performance**: Turborepo caching speeds up builds
4. **Scalability**: Easy to add new apps or packages
5. **Monorepo Tooling**: Better dependency management with pnpm workspaces

## Next Steps

1. **Install dependencies**: `pnpm install`
2. **Test extension build**: `pnpm --filter @lazyapply/extension build`
3. **Move environment variables**: Copy `.env` to `apps/extension/.env`
4. **Update CI/CD**: Update build scripts to use new structure
5. **Extract shared code**: Move common code to shared packages

## Rollback

If needed, you can rollback by:
1. Moving `apps/extension/*` back to root
2. Restoring original `package.json`
3. Deleting `apps/`, `packages/`, `turbo.json`, `pnpm-workspace.yaml`

## Questions?

See:
- [README.md](./README.md) - Architecture overview
- [GETTING_STARTED.md](./GETTING_STARTED.md) - Development guide
- [Turborepo Docs](https://turbo.build/repo/docs)
