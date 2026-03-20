import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const feedbackCommand = cli({
  site: 'grok',
  name: 'feedback',
  description: 'Give thumbs up or thumbs down feedback on the last grok response',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'rating', required: true, positional: true, help: 'Rating: up | down', choices: ['up', 'down'] },
  ],
  columns: ['Rating', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const rating = kwargs.rating as string;
    const isUp = rating === 'up';

    const clicked = await page.evaluate(`
      (function(up) {
        const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
        const ratingBtns = btns.filter(b => {
          const label = (b.getAttribute('aria-label') || b.title || b.textContent || '').toLowerCase();
          return label.includes('thumb') || label.includes('like') || label.includes('good') || label.includes('bad') || label.includes('helpful');
        });
        if (!ratingBtns.length) return false;
        // Get the last pair (for the most recent response)
        const target = ratingBtns[ratingBtns.length - (up ? 2 : 1)] || ratingBtns[ratingBtns.length - 1];
        if (target) { target.click(); return true; }
        return false;
      })()
    `);

    if (!clicked) return [{ Rating: rating, Status: 'Feedback button not found' }];
    return [{ Rating: rating, Status: 'Submitted' }];
  },
});
