# LazyApply Supabase Edge Functions

This package contains Supabase Edge Functions for the LazyApply platform.

## Development

```bash
# Start local development server
pnpm dev

# Deploy functions
pnpm deploy
```

## Structure

- `functions/` - Edge function handlers
- `supabase/` - Supabase configuration

## Adding a New Function

Create a new directory under `functions/` with an `index.ts` file:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  // Your function logic here
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```
