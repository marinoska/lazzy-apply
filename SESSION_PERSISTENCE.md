# Session Persistence Implementation

## Overview
Implemented persistent session management to keep users logged in after page reloads and extension restarts.

## Changes Made

### 1. Enhanced Session Restoration (`apps/extension/src/background/auth.ts`)
- **Improved `bootstrap()` function**: Now properly handles session restoration with token refresh
  - Restores session from Chrome storage on extension startup
  - Automatically refreshes expired tokens using refresh token
  - Updates stored session with new tokens after refresh
  - Broadcasts auth state changes to all content scripts
  - Cleans up invalid sessions

### 2. Auto Token Refresh (`apps/extension/src/lib/supabase.ts`)
- **Enabled `autoRefreshToken`**: Changed from `false` to `true`
  - Supabase client now automatically refreshes tokens before they expire
  - Keeps users logged in without manual intervention

### 3. Auth State Listener (`apps/extension/src/background/auth.ts`)
- **Added `setupAuthListener()` function**: Listens for Supabase auth events
  - `TOKEN_REFRESHED`: Updates Chrome storage with new tokens and broadcasts to content scripts
  - `SIGNED_OUT`: Cleans up stored session and notifies all tabs
  - Ensures all tabs stay in sync with auth state

### 4. Background Script Initialization (`apps/extension/src/background/index.ts`)
- **Setup auth listener on startup**: Ensures token refresh events are captured from the beginning

## How It Works

### On Extension Startup:
1. `setupAuthListener()` is called to listen for auth state changes
2. `bootstrap()` checks Chrome storage for existing session
3. If session exists, it's restored in Supabase client
4. If tokens are expired, they're automatically refreshed
5. Updated session is saved back to storage
6. All content scripts are notified of the auth state

### During Active Use:
1. Supabase client monitors token expiration
2. Before tokens expire, they're automatically refreshed
3. `TOKEN_REFRESHED` event triggers the auth listener
4. New tokens are saved to Chrome storage
5. All open tabs are notified of the updated session

### On Page Reload:
1. Content script requests current session from background
2. Background returns session from Chrome storage
3. Sidebar displays user as logged in
4. No re-authentication required

## Storage
- Sessions are stored in `chrome.storage.local` with key `dynoJob_session`
- Includes: `access_token`, `refresh_token`, `expires_at`, `user` object

## Benefits
- ✅ Users stay logged in across page reloads
- ✅ Users stay logged in across browser restarts
- ✅ Tokens are automatically refreshed before expiration
- ✅ All tabs stay synchronized with auth state
- ✅ Invalid sessions are automatically cleaned up
