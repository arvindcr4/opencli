import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const stopCommand = cli({
  site: 'claude',
  name: 'stop',
  description: 'Stop the current Claude.ai response generation',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Status'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');
    const result = await page.evaluate(`
      (function() {
        const btns = Array.from(document.querySelectorAll('button'));
        const stopBtn = btns.find(b => /stop/i.test(b.getAttribute('aria-label') || b.textContent || ''));
        if (stopBtn) { stopBtn.click(); return 'stopped'; }
        return 'not_generating';
      })()
    `);
    if (result === 'not_generating') return [{ Status: 'Nothing to stop' }];
    return [{ Status: 'Stopped' }];
  },
});
