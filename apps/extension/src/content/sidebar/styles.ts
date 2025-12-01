export function getSidebarStyles(): string {
	return `
    :host {
      display: block;
      font-family: system-ui, -apple-system, sans-serif;
    }
    :host *, :host *::before, :host *::after { 
      box-sizing: border-box;
    }
    .overlay {
      position: fixed;
      inset: 10px 10px 0 auto;
      width: calc(380px);
      max-width: calc((100vw - 32px));
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
      border-radius: calc(12px);
      box-shadow: 0 calc(8px) calc(32px) rgba(15, 23, 42, 0.2);
      overflow: auto;
    }
  `;
}
