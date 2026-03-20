import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const retryCommand = cli({
  site: 'chatgpt',
  name: 'retry',
  description: 'Retry (regenerate) the last ChatGPT response',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [],
  columns: ['Status', 'Action'],
  func: async (page: IPage | null, _kwargs: any) => {
    if (!page) throw new Error('Browser page not available');

    // Try the regenerate button
    const clicked = await page.evaluate(`
      (function() {
        const btn = document.querySelector('[aria-label*="Regenerate"]') ||
                    document.querySelector('[aria-label*="Retry"]') ||
                    document.querySelector('[data-testid="regenerate-response"]') ||
                    Array.from(document.querySelectorAll('button')).find(b =>
                      /regenerate|retry/i.test(b.textContent || b.getAttribute('aria-label') || ''));
        if (btn) { btn.click(); return true; }
        return false;
      })()
    `);

    if (clicked) return [{ Status: 'OK', Action: 'Clicked regenerate button' }];

    // Fallback: click the last message's edit/retry icon (hover-revealed buttons)
    const fallback = await page.evaluate(`
      (function() {
        const turns = document.querySelectorAll('[data-message-author-role="assistant"]');
        if (!turns.length) return false;
        const last = turns[turns.length - 1];
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
    return [{ Status: 'NotFound', Action: 'No regenerate button found' }];
  },
});
