import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const groundingCommand = cli({
  site: 'claude',
  name: 'grounding',
  description: 'Toggle Claude web search / grounding on or off',
  domain: 'claude.ai',
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
        const toggles = Array.from(document.querySelectorAll('[role="switch"], button[aria-pressed], input[type="checkbox"]'));
        const searchToggle = toggles.find(el => {
          const label = (el.getAttribute('aria-label') || el.title || el.closest('label')?.textContent || '').toLowerCase();
          return label.includes('search') || label.includes('web') || label.includes('browse');
        });
        if (!searchToggle) return null;
        return searchToggle.getAttribute('aria-checked') === 'true' || searchToggle.getAttribute('aria-pressed') === 'true';
      })()
    `);

    if (action === 'status') {
      if (current === null) return [{ Feature: 'Web search', Status: 'Toggle not found' }];
      return [{ Feature: 'Web search', Status: current ? 'On' : 'Off' }];
    }

    const shouldBeOn = action === 'on';
    if (current === shouldBeOn) return [{ Feature: 'Web search', Status: `Already ${action}` }];

    const toggled = await page.evaluate(`
      (function() {
        const toggles = Array.from(document.querySelectorAll('[role="switch"], button[aria-pressed]'));
        const t = toggles.find(el => {
          const label = (el.getAttribute('aria-label') || el.title || el.closest('label')?.textContent || '').toLowerCase();
          return label.includes('search') || label.includes('web') || label.includes('browse');
        });
        if (t) { t.click(); return true; }
        return false;
      })()
    `);

    return [{ Feature: 'Web search', Status: toggled ? `Turned ${action}` : 'Toggle not found' }];
  },
});
