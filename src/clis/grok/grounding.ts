import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const groundingCommand = cli({
  site: 'grok',
  name: 'grounding',
  description: 'Toggle Grok real-time web search / X search on or off',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
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
        const toggles = Array.from(document.querySelectorAll('[role="switch"], button[aria-pressed], [data-testid*="search"], [data-testid*="real-time"]'));
        const searchToggle = toggles.find(el => {
          const label = (el.getAttribute('aria-label') || el.title || (el.closest('label') || el.parentElement)?.textContent || '').toLowerCase();
          return label.includes('search') || label.includes('real.time') || label.includes('web');
        });
        if (!searchToggle) return null;
        return searchToggle.getAttribute('aria-checked') === 'true' || searchToggle.getAttribute('aria-pressed') === 'true';
      })()
    `);

    if (action === 'status') {
      if (current === null) return [{ Feature: 'Real-time search', Status: 'Toggle not found' }];
      return [{ Feature: 'Real-time search', Status: current ? 'On' : 'Off' }];
    }

    const shouldBeOn = action === 'on';
    if (current === shouldBeOn) return [{ Feature: 'Real-time search', Status: `Already ${action}` }];

    const toggled = await page.evaluate(`
      (function() {
        const toggles = Array.from(document.querySelectorAll('[role="switch"], button[aria-pressed]'));
        const t = toggles.find(el => {
          const label = (el.getAttribute('aria-label') || el.title || (el.closest('label') || el.parentElement)?.textContent || '').toLowerCase();
          return label.includes('search') || label.includes('real.time') || label.includes('web');
        });
        if (t) { t.click(); return true; }
        return false;
      })()
    `);

    return [{ Feature: 'Real-time search', Status: toggled ? `Turned ${action}` : 'Toggle not found' }];
  },
});
