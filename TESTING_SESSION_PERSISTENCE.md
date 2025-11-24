# Testing Session Persistence

## Test Scenarios

### Test 1: Login Persists After Page Reload
1. Load the extension and open the sidebar
2. Click "Sign in with Google" and complete authentication
3. Verify you see "Signed in" status with your email
4. Reload the page (Cmd+R or F5)
5. Open the sidebar again
6. **Expected**: You should still be logged in without needing to re-authenticate

### Test 2: Login Persists After Browser Restart
1. Sign in to the extension
2. Close the browser completely
3. Reopen the browser
4. Navigate to any page and open the extension sidebar
5. **Expected**: You should still be logged in

### Test 3: Token Auto-Refresh
1. Sign in to the extension
2. Check the browser console for background script logs
3. Wait for token expiration (typically 1 hour for Supabase)
4. **Expected**: You should see "[LazyJob] Session tokens refreshed and stored" in console
5. Open sidebar - should still be logged in

### Test 4: Logout Clears Session
1. Sign in to the extension
2. Click "Sign out"
3. Reload the page
4. Open the sidebar
5. **Expected**: You should see "You're not signed in" message

### Test 5: Invalid Session Cleanup
1. Sign in to the extension
2. Manually clear the session in Chrome DevTools:
   - Open DevTools → Application → Storage → Local Storage
   - Find `lazyJob_session` and modify it to invalid data
3. Reload the extension or restart browser
4. **Expected**: Invalid session should be cleaned up, user should be logged out

### Test 6: Multi-Tab Sync
1. Open the extension sidebar in Tab A and sign in
2. Open a new Tab B
3. Open the extension sidebar in Tab B
4. **Expected**: Tab B should show you as logged in
5. Sign out in Tab A
6. **Expected**: Tab B should also reflect the signed-out state

## Debugging

### Check Background Script Logs
1. Open `chrome://extensions`
2. Find "LazyApplyAgent" extension
3. Click "service worker" or "background page"
4. Check console for logs:
   - `[LazyJob] Initializing...`
   - `[LazyJob] Session restored successfully`
   - `[LazyJob] Session tokens refreshed and stored`

### Check Stored Session
1. Open DevTools → Application → Storage
2. Navigate to Local Storage → chrome-extension://[extension-id]
3. Look for `lazyJob_session` key
4. Verify it contains: `access_token`, `refresh_token`, `expires_at`, `user`

### Common Issues
- **Not staying logged in**: Check if `autoRefreshToken` is set to `true` in `supabase.ts`
- **Session not restoring**: Check background script logs for errors during `bootstrap()`
- **Tabs not syncing**: Verify `broadcastAuthChange()` is being called after auth state changes
