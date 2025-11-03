# Getting Started with LazyApply Monorepo

This guide will help you set up and start developing in the LazyApply Turborepo.

## Initial Setup

### 1. Install Dependencies

```bash
# Install pnpm if you haven't already
npm install -g pnpm@9

# Install all workspace dependencies
pnpm install
```

This will install dependencies for:
- Root workspace
- All apps (`apps/extension`, `apps/functions`)
- All packages (`packages/types`, `packages/schemas`, `packages/utils`, `packages/config`)

### 2. Environment Variables

Create `.env` files in the appropriate locations:

**For Extension (`apps/extension/.env`):**
```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**For Functions (`apps/functions/.env`):**
```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Development Workflow

### Running All Apps

```bash
# Start all apps in development mode
pnpm dev
```

This will start:
- Extension development server (Vite)
- Supabase Edge Functions local server

### Running Specific Apps

```bash
# Extension only
pnpm --filter @lazyapply/extension dev

# Functions only
pnpm --filter @lazyapply/functions dev
```

### Building

```bash
# Build all apps and packages
pnpm build

# Build specific app
pnpm --filter @lazyapply/extension build
```

## Working with Packages

### Using Shared Packages

All shared packages are automatically linked via workspace protocol. To use them in your app:

```typescript
// In apps/extension or apps/functions
import { User, JobApplication } from '@lazyapply/types';
import { userSchema } from '@lazyapply/schemas';
import { formatDate } from '@lazyapply/utils';
```

### Adding New Shared Code

1. **Add a type** → `packages/types/src/index.ts`
2. **Add a schema** → `packages/schemas/src/index.ts`
3. **Add a utility** → `packages/utils/src/index.ts`

No build step needed - TypeScript will resolve directly to source files.

## Extension Development

### Loading the Extension

1. Build the extension:
   ```bash
   cd apps/extension
   pnpm build
   ```

2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select `apps/extension/dist` directory

### Development Mode

```bash
cd apps/extension
pnpm dev:watch
```

This watches for changes and rebuilds automatically. Reload the extension in Chrome after changes.

### Creating Extension Zip

```bash
cd apps/extension
pnpm zip
```

Creates `extension.zip` in the `apps/extension` directory.

## Edge Functions Development

### Local Development

```bash
cd apps/functions
pnpm dev
```

This starts a local Supabase instance with your Edge Functions.

### Adding a New Function

1. Create directory: `apps/functions/functions/my-function/`
2. Add `index.ts`:
   ```typescript
   import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
   
   serve(async (req) => {
     return new Response(JSON.stringify({ success: true }), {
       headers: { 'Content-Type': 'application/json' }
     });
   });
   ```

### Deploying Functions

```bash
cd apps/functions
pnpm deploy
```

## Code Quality

### Linting

```bash
# Lint all packages
pnpm lint

# Lint specific package
pnpm --filter @lazyapply/extension lint
```

### Formatting

```bash
# Format all code
pnpm format

# Check and fix with Biome
pnpm check
```

## Turborepo Features

### Caching

Turborepo automatically caches build outputs. To clear cache:

```bash
pnpm clean
```

### Parallel Execution

Turborepo runs tasks in parallel when possible, respecting dependency order defined in `turbo.json`.

### Filtering

Run tasks for specific workspaces:

```bash
# Run dev for extension only
pnpm --filter @lazyapply/extension dev

# Run build for all apps (not packages)
pnpm --filter "./apps/*" build
```

## Common Issues

### Module Resolution Errors

If you see "Cannot find module '@lazyapply/...'":
1. Run `pnpm install` at the root
2. Check that the package is listed in your app's `package.json` dependencies
3. Verify the `paths` in your `tsconfig.json`

### Zod Not Found

The schemas package requires `zod`. Install it:
```bash
pnpm install
```

### Extension Not Loading

1. Ensure you've built the extension: `pnpm --filter @lazyapply/extension build`
2. Check that `apps/extension/dist` exists
3. Verify manifest.json is in the dist folder

## Next Steps

- Read the main [README.md](./README.md) for architecture overview
- Check individual app READMEs:
  - [Extension README](./apps/extension/README.md) (if exists)
  - [Functions README](./apps/functions/README.md)
- Explore the shared packages in `packages/`

## Useful Commands Reference

```bash
# Development
pnpm dev                                    # Run all apps
pnpm --filter @lazyapply/extension dev     # Run extension
pnpm --filter @lazyapply/functions dev     # Run functions

# Building
pnpm build                                  # Build everything
pnpm --filter @lazyapply/extension build   # Build extension
pnpm --filter @lazyapply/extension zip     # Create extension zip

# Code Quality
pnpm lint                                   # Lint all
pnpm format                                 # Format all
pnpm check                                  # Biome check & fix

# Maintenance
pnpm clean                                  # Clean builds & cache
pnpm install                                # Install/update deps
```
