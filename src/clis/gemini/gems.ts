import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const gemsCommand = cli({
  site: 'gemini',
  name: 'gems',
  description: 'Browse, list, or launch Gemini Gems (custom AI models)',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'query', required: false, positional: true, help: 'Search for a Gem by name (optional)' },
    { name: 'launch', required: false, help: 'Gem name to launch directly' },
  ],
  columns: ['Name', 'Description'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const query = (kwargs.query as string | undefined)?.toLowerCase() || '';
    const launch = (kwargs.launch as string | undefined)?.toLowerCase() || '';

    await page.goto('https://gemini.google.com/gems');
    await page.wait(3);

    if (launch) {
      const launched = await page.evaluate(`
        (function(name) {
          const items = Array.from(document.querySelectorAll('[class*="gem"], [class*="Gem"], mat-list-item, a'));
          const gem = items.find(el => (el.textContent || '').toLowerCase().includes(name));
          if (gem) { gem.click(); return true; }
          return false;
        })(${JSON.stringify(launch)})
      `);
      return [{ Name: launch, Description: launched ? 'Launched' : 'Gem not found' }];
    }

    const gems = await page.evaluate(`
      (function(q) {
        const items = Array.from(document.querySelectorAll('[class*="gem-item"], [class*="GemItem"], .gem, a[href*="/gems/"]'));
        return JSON.stringify(
          items
            .filter(el => !q || (el.textContent || '').toLowerCase().includes(q))
            .slice(0, 20)
            .map(el => ({
              name: (el.querySelector('[class*="name"], h3, h2, strong') || el).textContent?.trim().slice(0, 60) || '',
              description: (el.querySelector('[class*="description"], p') || { textContent: '' }).textContent?.trim().slice(0, 100) || ''
            }))
        );
      })(${JSON.stringify(query)})
    `);

    let gemList: Array<{ name: string; description: string }> = [];
    try { gemList = JSON.parse(gems as string); } catch { /* ignore */ }
    if (!gemList.length) return [{ Name: 'No gems found', Description: '' }];
    return gemList.map(g => ({ Name: g.name || 'Unknown', Description: g.description || '' }));
  },
});
