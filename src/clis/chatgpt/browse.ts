import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const browseCommand = cli({
  site: 'chatgpt',
  name: 'browse',
  description: 'Toggle ChatGPT web browsing / search mode on or off',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    { name: 'action', required: false, positional: true, help: 'Action: on | off | status (default: status)', choices: ['on', 'off', 'status'], default: 'status' },
  ],
  columns: ['Feature', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const action = (kwargs.action as string) || 'status';

    const current = await page.evaluate(`
      (function() {
        const toggles = Array.from(document.querySelectorAll('[role="switch"], button[aria-pressed]'));
        const browseToggle = toggles.find(el => {
          const label = (el.getAttribute('aria-label') || el.title || '').toLowerCase();
          return label.includes('search') || label.includes('browse') || label.includes('web');
        });
        if (!browseToggle) return null;
        return browseToggle.getAttribute('aria-checked') === 'true' || browseToggle.getAttribute('aria-pressed') === 'true';
      })()
    `);

    if (action === 'status') {
      if (current === null) return [{ Feature: 'Web browsing', Status: 'Toggle not found' }];
      return [{ Feature: 'Web browsing', Status: current ? 'On' : 'Off' }];
    }

    const shouldBeOn = action === 'on';
    if (current === shouldBeOn) return [{ Feature: 'Web browsing', Status: `Already ${action}` }];

    const toggled = await page.evaluate(`
      (function() {
        const toggles = Array.from(document.querySelectorAll('[role="switch"], button[aria-pressed]'));
        const t = toggles.find(el => {
          const label = (el.getAttribute('aria-label') || el.title || '').toLowerCase();
          return label.includes('search') || label.includes('browse') || label.includes('web');
        });
        if (t) { t.click(); return true; }
        // Also check for a tools/attachment button that opens tool selection
        const toolsBtn = document.querySelector('button[aria-label*="Attach" i], button[data-testid*="attach"]');
        if (toolsBtn) { toolsBtn.click(); return 'tools_opened'; }
        return false;
      })()
    `);

    return [{ Feature: 'Web browsing', Status: toggled ? `Turned ${action}` : 'Browse toggle not found' }];
  },
});
