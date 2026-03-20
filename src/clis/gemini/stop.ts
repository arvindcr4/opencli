import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const stopCommand = cli({
  site: 'gemini',
  name: 'stop',
  description: 'Stop the current Gemini response generation',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Status'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');
    const result = await page.evaluate(`
      (function() {
        const btn = document.querySelector('[aria-label*="Stop"], [data-mat-icon-name="stop"], .stop-button');
        const stopBtn = btn?.closest ? (btn.closest('button') || btn) : btn;
        if (stopBtn) { stopBtn.click(); return 'stopped'; }
        const btns = Array.from(document.querySelectorAll('button'));
        const found = btns.find(b => /stop/i.test(b.getAttribute('aria-label') || b.textContent || ''));
        if (found) { found.click(); return 'stopped'; }
        return 'not_generating';
      })()
    `);
    if (result === 'not_generating') return [{ Status: 'Nothing to stop' }];
    return [{ Status: 'Stopped' }];
  },
});
