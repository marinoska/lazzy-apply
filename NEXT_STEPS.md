# Next Steps After Turborepo Migration

## Immediate Actions Required

### 1. Install Dependencies

```bash
# Clean old node_modules and lockfiles
rm -rf node_modules package-lock.json

# Install with pnpm
pnpm install
```

This will:
- Install Turborepo
- Set up all workspace dependencies
- Link workspace packages together
- Install Zod for the schemas package

### 2. Move Environment Variables

```bash
# Copy .env to extension app
cp .env apps/extension/.env

# Or create new ones
cat > apps/extension/.env << EOF
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
EOF
```

### 3. Test the Build

```bash
# Build extension
pnpm --filter @lazyapply/extension build

# Verify dist folder
ls -la apps/extension/dist
```

### 4. Reload IDE

Close and reopen your IDE to clear TypeScript cache and recognize the new structure.

## Optional Improvements

### Extract Shared Code

Look for opportunities to move code into shared packages:

**Types** (`packages/types/src/index.ts`):
- User interfaces
- Job application types
- API response types
- Extension message types

**Schemas** (`packages/schemas/src/index.ts`):
- Validation schemas for forms
- API request/response validation
- Storage data validation

**Utils** (`packages/utils/src/index.ts`):
- Date formatting
- String manipulation
- Common helpers
- API utilities

### Example Migration

**Before** (in `apps/extension/src/lib/utils.ts`):
```typescript
export function formatJobDate(date: string): string {
  return new Date(date).toLocaleDateString();
}
```

**After** (in `packages/utils/src/index.ts`):
```typescript
export function formatJobDate(date: string): string {
  return new Date(date).toLocaleDateString();
}
```

**Usage** (in `apps/extension/src/components/JobCard.tsx`):
```typescript
import { formatJobDate } from '@lazyapply/utils';
```

### Set Up CI/CD

Update your CI/CD pipeline to use Turborepo:

```yaml
# Example GitHub Actions
- name: Install dependencies
  run: pnpm install

- name: Build
  run: pnpm build

- name: Build extension zip
  run: pnpm --filter @lazyapply/extension zip
```

### Add More Scripts

Consider adding to root `package.json`:

```json
{
  "scripts": {
    "test": "turbo run test",
    "type-check": "turbo run type-check",
    "extension:dev": "pnpm --filter @lazyapply/extension dev",
    "extension:build": "pnpm --filter @lazyapply/extension build",
    "functions:dev": "pnpm --filter @lazyapply/functions dev"
  }
}
```

## Verification Checklist

- [ ] `pnpm install` completes successfully
- [ ] `pnpm build` builds all packages
- [ ] Extension builds: `pnpm --filter @lazyapply/extension build`
- [ ] Extension dist folder contains manifest.json
- [ ] Extension loads in Chrome without errors
- [ ] TypeScript has no errors (after IDE reload)
- [ ] Environment variables are in correct location

## Common Issues & Solutions

### Issue: "Cannot find module '@lazyapply/...'"

**Solution:**
```bash
pnpm install
```

### Issue: TypeScript errors about missing files

**Solution:**
1. Close IDE
2. Delete `.vscode` or IDE cache
3. Reopen IDE
4. Run `pnpm install`

### Issue: Extension doesn't load

**Solution:**
1. Ensure build completed: `pnpm --filter @lazyapply/extension build`
2. Check `apps/extension/dist` exists
3. Load `apps/extension/dist` in Chrome (not root dist)

### Issue: Zod not found in schemas package

**Solution:**
```bash
pnpm install
```

## Development Workflow

### Daily Development

```bash
# Start everything
pnpm dev

# Or just extension
pnpm --filter @lazyapply/extension dev:watch
```

### Making Changes

1. Edit code in `apps/extension/src/`
2. Changes hot-reload automatically
3. Reload extension in Chrome if needed

### Adding Shared Code

1. Add to appropriate package in `packages/`
2. Export from package's `src/index.ts`
3. Import in apps using `@lazyapply/package-name`

### Building for Production

```bash
# Build everything
pnpm build

# Create extension zip
pnpm --filter @lazyapply/extension zip

# Zip will be at: apps/extension/extension.zip
```

## Resources

- [README.md](./README.md) - Project overview
- [GETTING_STARTED.md](./GETTING_STARTED.md) - Detailed development guide
- [MIGRATION_NOTES.md](./MIGRATION_NOTES.md) - What changed during migration
- [Turborepo Docs](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)

## Questions?

If you encounter issues:
1. Check this file first
2. Review GETTING_STARTED.md
3. Check Turborepo documentation
4. Verify all dependencies are installed

## Success Indicators

You'll know the migration is successful when:
- ✅ `pnpm install` completes without errors
- ✅ `pnpm build` builds all packages
- ✅ Extension loads in Chrome
- ✅ No TypeScript errors in IDE
- ✅ Hot reload works during development
- ✅ Can create extension.zip successfully
