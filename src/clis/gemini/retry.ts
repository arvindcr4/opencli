import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const retryCommand = cli({
  site: 'gemini',
  name: 'retry',
  description: 'Retry (regenerate) the last Gemini response',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Status', 'Action'],
  func: async (page: IPage | null, _kwargs: any) => {
    if (!page) throw new Error('Browser page not available');

    const clicked = await page.evaluate(`
      (function() {
        // Try regenerate button in toolbar
        const btn = document.querySelector('[aria-label*="Regenerate"]') ||
                    document.querySelector('[aria-label*="Retry"]') ||
                    document.querySelector('[data-mat-icon-name*="refresh"]') ||
                    Array.from(document.querySelectorAll('button, [role="button"]')).find(b =>
                      /regenerate|retry|refresh response/i.test(b.getAttribute('aria-label') || b.textContent || ''));
        if (btn) { btn.click(); return 'toolbar'; }

        // Try the response action bar on last response
        const responses = document.querySelectorAll('model-response');
        if (responses.length) {
          const last = responses[responses.length - 1];
          const rb = last.querySelector('[aria-label*="Regenerate"], [aria-label*="Retry"], [aria-label*="Retry response"]');
          if (rb) { rb.click(); return 'response-bar'; }
        }
        return false;
      })()
    `);

    if (clicked) return [{ Status: 'OK', Action: `Clicked retry (${clicked})` }];
    return [{ Status: 'NotFound', Action: 'No retry button found' }];
  },
});
