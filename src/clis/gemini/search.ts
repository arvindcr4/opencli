import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const searchCommand = cli({
  site: 'gemini',
  name: 'search',
  description: 'Search through Gemini conversation history',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'query', required: true, positional: true, help: 'Search query' },
    { name: 'limit', required: false, help: 'Max results (default: 10)', default: '10' },
  ],
  columns: ['Title', 'URL'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const query = (kwargs.query as string).toLowerCase();
    const limit = parseInt(kwargs.limit as string, 10) || 10;

    await page.goto('https://gemini.google.com/app');
    await page.wait(3);

    const results = await page.evaluate(`
      (function(q, lim) {
        const items = Array.from(document.querySelectorAll(
          'a[href*="/app/"], .conversation-item a, [class*="conversation"] a, nav a'
        ));
        const matches = items
          .filter(a => {
            const text = (a.textContent || '').toLowerCase();
            return text.includes(q) && a.href && a.href.includes('/app/');
          })
          .slice(0, lim)
          .map(a => ({ title: (a.textContent || '').trim().slice(0, 80), url: a.href }));
        return JSON.stringify(matches);
      })(${JSON.stringify(query)}, ${limit})
    `);

    let matches: Array<{ title: string; url: string }> = [];
    try { matches = JSON.parse(results as string); } catch { /* ignore */ }

    if (!matches.length) return [{ Title: `No results for "${query}"`, URL: '' }];
    return matches.map(m => ({ Title: m.title, URL: m.url }));
  },
});
