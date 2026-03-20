import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const gptsCommand = cli({
  site: 'chatgpt',
  name: 'gpts',
  description: 'Browse or navigate to Custom GPTs on ChatGPT',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    { name: 'query', required: false, positional: true, help: 'Search for a GPT by name (optional)' },
    { name: 'launch', required: false, help: 'GPT name or URL fragment to open directly' },
  ],
  columns: ['Name', 'URL'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const query = (kwargs.query as string | undefined)?.toLowerCase() || '';
    const launch = (kwargs.launch as string | undefined)?.toLowerCase() || '';

    if (launch) {
      // Direct navigation to GPT
      const url = launch.startsWith('http') ? launch : `https://chatgpt.com/g/${launch}`;
      await page.goto(url);
      await page.wait(2);
      return [{ Name: launch, URL: url }];
    }

    await page.goto('https://chatgpt.com/gpts');
    await page.wait(3);

    if (query) {
      // Search for GPT
      const snapshot = await page.snapshot({ interactive: true });
      const nodes = (snapshot?.nodes as any[]) ?? [];
      const searchInput = nodes.find((n: any) =>
        n.role === 'searchbox' || (n.role === 'textbox' && (n.placeholder || '').toLowerCase().includes('search'))
      )?.ref;
      if (searchInput) {
        await page.click(searchInput);
        await page.typeText(searchInput, query);
        await page.wait(2);
      }
    }

    // Extract GPT list
    const results = await page.evaluate(`
      (function(q) {
        const cards = Array.from(document.querySelectorAll('a[href*="/g/"], [class*="gpt-card"] a, [data-testid*="gpt"] a'));
        return JSON.stringify(
          cards
            .filter(a => !q || (a.textContent || '').toLowerCase().includes(q))
            .slice(0, 20)
            .map(a => ({
              name: (a.querySelector('[class*="name"], h3, h2, strong') || a).textContent?.trim().slice(0, 60) || a.href,
              url: a.href
            }))
        );
      })(${JSON.stringify(query)})
    `);

    let gpts: Array<{ name: string; url: string }> = [];
    try { gpts = JSON.parse(results as string); } catch { /* ignore */ }
    if (!gpts.length) return [{ Name: 'No GPTs found', URL: '' }];
    return gpts.map(g => ({ Name: g.name, URL: g.url }));
  },
});
