export function getSidebarStyles(): string {
	return `
    :host {
      display: block;
      font-family: system-ui, -apple-system, sans-serif;
      pointer-events: none;
    }
    :host *, :host *::before, :host *::after { 
      box-sizing: border-box;
    }
    .toggle-tab {
      position: fixed;
      top: 10px;
      right: 0;
      width: 32px;
      display: flex;
      flex-direction: column;
      gap: 1px;
      z-index: 2147483647;
      pointer-events: auto;
      opacity: 1;
      visibility: visible;
      transition: opacity 0.3s ease-in-out, visibility 0.3s, transform 0.2s;
    }
    .toggle-tab:hover {
      transform: translateX(-2px);
    }
    .toggle-tab.hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    .toggle-tab-open {
      width: 100%;
      height: 60px;
      background: rgba(67, 160, 71, 0.95);
      border: none;
      border-radius: 8px 0 0 0;
      box-shadow: -2px 2px 8px rgba(0, 0, 0, 0.15);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      transition: background 0.2s;
    }
    .toggle-tab-open:hover {
      background: rgba(67, 160, 71, 1);
    }
    .toggle-tab-close {
      width: 100%;
      height: 28px;
      background: rgba(239, 68, 68, 0.95);
      border: none;
      border-radius: 0 0 0 8px;
      box-shadow: -2px 2px 8px rgba(0, 0, 0, 0.15);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      transition: background 0.2s;
    }
    .toggle-tab-close:hover {
      background: rgba(239, 68, 68, 1);
    }
    .overlay {
      position: fixed;
      top: 10px;
      right: 10px;
      width: calc(380px);
      max-width: calc((100vw - 32px));
      z-index: 2147483647;
      opacity: 0;
      visibility: hidden;
      transform: translateX(100%);
      transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out, visibility 0.3s;
    }
    .overlay.visible {
      opacity: 1;
      visibility: visible;
      transform: translateX(0);
    }
    .panel {
      background: rgba(255, 255, 255, 0.98);
      border-radius: calc(12px);
      box-shadow: 0 calc(8px) calc(32px) rgba(15, 23, 42, 0.2);
      overflow: auto;
      pointer-events: auto;
    }
  `;
}
