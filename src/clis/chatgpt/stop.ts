import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const stopCommand = cli({
  site: 'chatgpt',
  name: 'stop',
  description: 'Stop the current ChatGPT generation',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [],
  columns: ['Status'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');

    const result = await page.evaluate(`
      (function() {
        // Try data-testid first (most reliable)
        let btn = document.querySelector('[data-testid="stop-button"]');
        if (!btn) {
          // Fall back to any "Stop" labeled button
          btn = Array.from(document.querySelectorAll('button')).find(
            b => /^stop/i.test((b.textContent || b.getAttribute('aria-label') || '').trim())
          ) || null;
        }
        if (!btn) return 'not_generating';
        btn.click();
        return 'stopped';
      })()
    `);

    const status = result as string;
    if (status === 'not_generating') return [{ Status: 'Nothing to stop — ChatGPT is idle' }];
    return [{ Status: 'Generation stopped' }];
  },
});
