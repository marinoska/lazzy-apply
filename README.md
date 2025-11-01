# LazyApplyAgent Chrome Extension

A Chrome extension that provides seamless Supabase authentication with Google OAuth for LazyApplyAgent sessions.

## Features

- **Google OAuth Integration**: Sign in with your Google account via Supabase
- **Sidebar UI**: Clean, modern sidebar interface for authentication
- **Session Management**: Automatic session persistence and restoration
- **Shadow DOM**: Isolated styles that won't conflict with host pages
- **Type-Safe**: Built with TypeScript for better developer experience

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

## Architecture

### Components

- **Background Script** (`src/background/index.ts`): Service worker handling OAuth flow and session management
- **Content Script** (`src/content/index.ts`): Injected into web pages to handle sidebar display
- **Sidebar App** (`src/content/sidebarApp.tsx`): React-based UI for authentication
- **Supabase Client** (`src/lib/supabase.ts`): Configured Supabase client for auth operations

### Build System

The project uses a dual-build approach:

1. **Background Script**: Built as ES module (supports `type: "module"` in manifest)
2. **Content Script**: Built as IIFE (self-contained, no imports required)

## OAuth Flow

1. User clicks extension icon → sidebar opens
2. User clicks "Sign in with Google"
3. Background script initiates OAuth with Supabase
4. Chrome's `identity.launchWebAuthFlow` handles the OAuth redirect
5. Tokens are extracted from URL hash and stored
6. Session is broadcast to all content scripts via `AUTH_CHANGED`

## Message Passing

The extension uses Chrome's message passing API:

- `SHOW_MODAL`: Open the authentication sidebar
- `AUTH_CHANGED`: Broadcast session updates
- `GET_AUTH`: Fetch current session
- `OAUTH_START`: Initiate OAuth flow
- `LOGOUT`: Sign out user

## Project Structure

```
LazyApplyAgent/
├── src/
│   ├── background/
│   │   └── index.ts          # Service worker
│   ├── content/
│   │   ├── index.ts          # Content script
│   │   └── sidebarApp.tsx    # React sidebar UI
│   └── lib/
│       └── supabase.ts       # Supabase client
├── dist/                     # Build output
├── manifest.json             # Extension manifest
├── vite.config.ts           # Build configuration
└── package.json             # Dependencies
```

## Technologies

- **TypeScript**: Type-safe development
- **React**: UI framework
- **Material-UI Joy**: Component library
- **Vite**: Build tool
- **Supabase**: Authentication backend
- **Chrome Extension APIs**: Browser integration

## Troubleshooting

- Ensure the Supabase redirect URI matches `https://${chrome.runtime.id}.chromiumapp.org/`
- Check background service worker logs: `chrome://extensions` → Details → Inspect views
- Chrome may recycle the service worker; it automatically restores sessions on startup

## License

ISC
