# Supabase Google Login (Popup) Extension

This project is a minimal Chrome extension (Manifest V3) that uses a React + TypeScript popup and a background service worker to authenticate with Supabase via **Sign in with Google**. The Supabase session is persisted inside `chrome.storage.local` so the popup can mirror auth state instantly.

## Prerequisites

- Node.js 18+
- A Supabase project with Google provider enabled
- A Chrome extension OAuth redirect URI configured as `https://<extension-id>.chromiumapp.org/`

## Environment Variables

Create a `.env` file based on `.env.example`:

```
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

> The keys are embedded in the extension bundle; keep your Supabase Row Level Security rules tight.

## Development

```bash
npm install
npm run dev
```

- Vite serves the popup from `http://localhost:5173/popup`.
- Background service worker rebuilds automatically; reload the extension when iterating.

## Production Build

```bash
npm run build
```

Output lands in `dist/` with the required structure:

```
dist/
  manifest.json
  popup/index.html
  background/index.js
  assets/...
```

## Load in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Toggle **Developer mode**.
4. Click **Load unpacked** and choose the `dist/` directory.

## OAuth Flow Overview

1. Popup sends `OAUTH_START` to the background.
2. Background calls `supabase.auth.signInWithOAuth` and launches the Chrome WebAuth flow.
3. After Supabase redirects back with a `code`, the background exchanges it for a session using `exchangeCodeForSession`.
4. Session is stored under `supabaseSession` in `chrome.storage.local` and broadcast via `AUTH_CHANGED`.
5. Popup reacts to auth changes, renders the user email, and signs out via `LOGOUT`.

## Troubleshooting

- Ensure the Supabase redirect URI matches `https://${chrome.runtime.id}.chromiumapp.org/`.
- If the popup stays on “Loading…”, inspect the background service worker logs (`chrome://extensions` → Details → Inspect views).
- Chrome may recycle the service worker; it automatically rehydrates Supabase when a stored session exists.
