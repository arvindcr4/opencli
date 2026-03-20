import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const searchCommand = cli({
  site: 'grok',
  name: 'search',
  description: 'Search through Grok conversation history',
  domain: 'grok.com',
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

    await page.goto('https://grok.com');
    await page.wait(3);

    const results = await page.evaluate(`
      (function(q, lim) {
        const links = Array.from(document.querySelectorAll('a[href*="/chat/"], a[href*="/c/"], nav a'));
        const matches = links
          .filter(a => {
            const text = (a.textContent || '').toLowerCase();
            const href = a.href || '';
            return text.includes(q) && href.includes('grok.com');
          })
          .slice(0, lim)
          .map(a => ({ title: (a.textContent || '').trim().slice(0, 80), url: a.href }));
        if (!matches.length) {
          return JSON.stringify(links.filter(a => a.href?.includes('grok.com')).slice(0, lim).map(a => ({
            title: (a.textContent || '').trim().slice(0, 80),
            url: a.href
          })));
        }
        return JSON.stringify(matches);
      })(${JSON.stringify(query)}, ${limit})
    `);

    let matches: Array<{ title: string; url: string }> = [];
    try { matches = JSON.parse(results as string); } catch { /* ignore */ }

    if (!matches.length) return [{ Title: `No results for "${query}"`, URL: '' }];
    return matches.map(m => ({ Title: m.title, URL: m.url }));
  },
});
