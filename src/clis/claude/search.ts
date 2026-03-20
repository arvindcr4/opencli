import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const searchCommand = cli({
  site: 'claude',
  name: 'search',
  description: 'Search through Claude.ai conversation history',
  domain: 'claude.ai',
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

    await page.goto('https://claude.ai/chats');
    await page.wait(3);

    // Try to use built-in search
    const searchOpened = await page.evaluate(`
      (function() {
        const searchBtn = document.querySelector('button[aria-label*="Search"], input[placeholder*="Search"]');
        if (searchBtn) { searchBtn.click(); return true; }
        return false;
      })()
    `);

    if (searchOpened) {
      await page.wait(1);
      const snapshot = await page.snapshot({ interactive: true });
      const nodes = (snapshot?.nodes as any[]) ?? [];
      const searchInput = nodes.find((n: any) => n.role === 'searchbox' || (n.role === 'textbox' && n.placeholder?.toLowerCase().includes('search')))?.ref;
      if (searchInput) {
        await page.click(searchInput);
        await page.typeText(searchInput, query);
        await page.wait(2);
      }
    }

    const results = await page.evaluate(`
      (function(q, lim) {
        const links = Array.from(document.querySelectorAll('a[href*="/chat/"], a[href*="/conversation/"]'));
        const matches = links
          .filter(a => (a.textContent || '').toLowerCase().includes(q))
          .slice(0, lim)
          .map(a => ({ title: (a.textContent || '').trim().slice(0, 80), url: a.href }));
        // If no filtered results, return all visible conversations
        if (!matches.length) {
          return JSON.stringify(links.slice(0, lim).map(a => ({
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
