import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const projectsCommand = cli({
  site: 'grok',
  name: 'projects',
  description: 'List or navigate to Grok conversation groups/projects',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'name', required: false, positional: true, help: 'Project name to navigate to (optional)' },
  ],
  columns: ['Name', 'URL'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const targetName = (kwargs.name as string | undefined)?.toLowerCase() || '';

    await page.goto('https://grok.com');
    await page.wait(3);

    const projects = await page.evaluate(`
      (function(q) {
        const sections = Array.from(document.querySelectorAll('[class*="group"], [class*="folder"], [class*="project"], section'));
        const results = [];
        for (const section of sections) {
          const links = Array.from(section.querySelectorAll('a[href]'));
          if (links.length) {
            const title = section.querySelector('h2, h3, [class*="title"]')?.textContent?.trim() || 'Group';
            if (!q || title.toLowerCase().includes(q)) {
              links.forEach(a => results.push({
                name: title + ' / ' + (a.textContent || '').trim().slice(0, 40),
                url: a.href
              }));
            }
          }
        }
        // Fallback: all nav links
        if (!results.length) {
          const links = Array.from(document.querySelectorAll('nav a[href*="/chat/"], nav a[href*="/c/"]'));
          links.slice(0, 10).forEach(a => results.push({
            name: (a.textContent || '').trim().slice(0, 60),
            url: a.href
          }));
        }
        return JSON.stringify(results.slice(0, 20));
      })(${JSON.stringify(targetName)})
    `);

    let items: Array<{ name: string; url: string }> = [];
    try { items = JSON.parse(projects as string); } catch { /* ignore */ }
    if (!items.length) return [{ Name: 'No projects found', URL: '' }];

    if (targetName && items.length === 1) {
      await page.goto(items[0].url);
    }

    return items.map(item => ({ Name: item.name, URL: item.url }));
  },
});
