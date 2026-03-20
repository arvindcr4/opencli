import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const retryCommand = cli({
  site: 'claude',
  name: 'retry',
  description: 'Retry (regenerate) the last Claude.ai response',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Status', 'Action'],
  func: async (page: IPage | null, _kwargs: any) => {
    if (!page) throw new Error('Browser page not available');

    const clicked = await page.evaluate(`
      (function() {
        const btn = document.querySelector('[aria-label*="Retry"]') ||
                    document.querySelector('[aria-label*="Regenerate"]') ||
                    document.querySelector('[data-testid="retry-button"]') ||
                    Array.from(document.querySelectorAll('button')).find(b =>
                      /retry|regenerate/i.test(b.getAttribute('aria-label') || b.textContent || ''));
        if (btn) { btn.click(); return true; }
        return false;
      })()
    `);

    if (clicked) return [{ Status: 'OK', Action: 'Clicked retry button' }];

    // Fallback: look inside last assistant message actions
    const fallback = await page.evaluate(`
      (function() {
        const msgs = document.querySelectorAll('[data-testid="assistant-message"]');
        if (!msgs.length) return false;
        const last = msgs[msgs.length - 1];
        const btns = last.querySelectorAll('button');
        for (const b of btns) {
          if (/retry|regenerate/i.test(b.getAttribute('aria-label') || b.textContent || '')) {
            b.click(); return true;
          }
        }
        return false;
      })()
    `);

    if (fallback) return [{ Status: 'OK', Action: 'Clicked message-level retry' }];
    return [{ Status: 'NotFound', Action: 'No retry button found' }];
  },
});
