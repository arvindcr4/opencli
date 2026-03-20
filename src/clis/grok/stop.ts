import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const stopCommand = cli({
  site: 'grok',
  name: 'stop',
  description: 'Stop the current Grok generation',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Status'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');
    const result = await page.evaluate(`
      (function() {
        const btn = document.querySelector('[data-testid="stop-button"], [aria-label*="Stop"]');
        if (btn) { btn.click(); return 'stopped'; }
        const btns = Array.from(document.querySelectorAll('button'));
        const found = btns.find(b => /stop/i.test(b.textContent || b.getAttribute('aria-label') || ''));
        if (found) { found.click(); return 'stopped'; }
        return 'not_generating';
      })()
    `);
    if (result === 'not_generating') return [{ Status: 'Nothing to stop' }];
    return [{ Status: 'Stopped' }];
  },
});
