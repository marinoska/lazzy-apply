/**
 * Get sidebar CSS styles for shadow DOM
 */
export function getSidebarStyles(): string {
  return `
    :host { all: initial; }
    :host *, :host *::before, :host *::after { box-sizing: border-box; }
    .overlay {
      position: fixed;
      inset: 0 0 0 auto;
      width: 320px;
      max-width: calc(100vw - 32px);
      padding: 16px;
      z-index: 2147483647;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s;
      pointer-events: none;
    }
    .overlay.visible {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }
    .panel {
      background: rgba(255, 255, 255, 0.98);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(15, 23, 42, 0.2);
      overflow: auto;
    }
  `;
}
