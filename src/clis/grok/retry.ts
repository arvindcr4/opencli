import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const retryCommand = cli({
  site: 'grok',
  name: 'retry',
  description: 'Retry (regenerate) the last Grok response',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Status', 'Action'],
  func: async (page: IPage | null, _kwargs: any) => {
    if (!page) throw new Error('Browser page not available');

    const clicked = await page.evaluate(`
      (function() {
        const btn = document.querySelector('[aria-label*="Regenerate"]') ||
                    document.querySelector('[aria-label*="Retry"]') ||
                    document.querySelector('[data-testid*="regenerate"]') ||
                    document.querySelector('[data-testid*="retry"]') ||
                    Array.from(document.querySelectorAll('button')).find(b =>
                      /regenerate|retry/i.test(b.getAttribute('aria-label') || b.textContent || ''));
        if (btn) { btn.click(); return true; }
        return false;
      })()
    `);

    if (clicked) return [{ Status: 'OK', Action: 'Clicked retry button' }];
    return [{ Status: 'NotFound', Action: 'No retry button found' }];
  },
});
