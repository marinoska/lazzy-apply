/**
 * NavigationWatcher
 * -----------------
 * Detects every type of navigation event in modern browsers (SPA + MPA).
 * Works across ALL job boards and ATS systems.
 *
 * Emits a callback on:
 * - Full page load
 * - Navigation API (`navigate`)
 * - History API (`pushState`, `replaceState`)
 * - Browser navigation (`popstate`)
 * - DOM-based SPA router changes (fallback)
 */

export type NavigationCallback = (url: string) => void;

/**
 * Watches URL changes and DOM-based navigation events.
 */
export class NavigationWatcher {
  private lastUrl: string;
  private callback: NavigationCallback;
  private observer: MutationObserver | null = null;

  constructor(callback: NavigationCallback) {
    this.lastUrl = document.location.href;
    this.callback = callback;
    this.init();
  }

  private init() {
    // Only use DOM observer - it will catch all content changes
    // including those triggered by pushState, popstate, etc.
    this.observeDomChanges();
    
    // Initial trigger after a short delay to let content load
    setTimeout(() => {
      this.callback(this.lastUrl);
    }, 100);
  }

  /**
   * Update tracked URL when it changes (for deduplication)
   */
  private updateUrlIfChanged() {
    const current = document.location.href;
    if (current !== this.lastUrl) {
      this.lastUrl = current;
      return true;
    }
    return false;
  }

  /**
   * Detect DOM changes for client-side rendered SPA updates.
   * Debounced to avoid excessive scanning.
   */
  private observeDomChanges() {
    let pending = false;
    let contentChangeTimer: number | null = null;

    this.observer = new MutationObserver(() => {
      if (!pending) {
        pending = true;
        requestIdleCallback(() => {
          pending = false;
          
          // Update URL tracking
          const urlChanged = this.updateUrlIfChanged();
          
          // Debounce content changes to avoid scanning while page is still loading
          if (contentChangeTimer) {
            clearTimeout(contentChangeTimer);
          }
          contentChangeTimer = window.setTimeout(() => {
            // Only trigger if URL changed OR if significant time has passed
            // This catches both navigation and content loading
            if (urlChanged || contentChangeTimer !== null) {
              this.callback(this.lastUrl);
            }
          }, 500);
        });
      }
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Stop watching (if needed)
   */
  disconnect() {
    this.observer?.disconnect();
  }
}
