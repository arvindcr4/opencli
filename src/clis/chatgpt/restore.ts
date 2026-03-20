import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const restoreCommand = cli({
  site: 'chatgpt',
  name: 'restore',
  description: 'Restore an archived ChatGPT conversation',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    { name: 'query', required: false, positional: true, help: 'Search query to find archived conversation' },
    { name: 'limit', required: false, help: 'Max archived conversations to list (default: 10)', default: '10' },
  ],
  columns: ['Title', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const query = (kwargs.query as string | undefined)?.toLowerCase() || '';
    const limit = parseInt(kwargs.limit as string, 10) || 10;

    // Navigate to archived conversations
    await page.goto('https://chatgpt.com/');
    await page.wait(2);

    // Open settings or archived section
    const opened = await page.evaluate(`
      (function() {
        // Look for archived section in sidebar
        const archiveLink = Array.from(document.querySelectorAll('a, button, [role="button"]')).find(el => {
          const text = (el.textContent || el.getAttribute('aria-label') || '').toLowerCase();
          return text.includes('archive') || text.includes('archived');
        });
        if (archiveLink) { archiveLink.click(); return true; }
        return false;
      })()
    `);

    if (!opened) {
      // Try settings > archived
      await page.goto('https://chatgpt.com/#settings');
      await page.wait(2);
    }

    await page.wait(2);

    const archived = await page.evaluate(`
      (function(q, lim) {
        const links = Array.from(document.querySelectorAll('a[href*="/c/"], nav a'));
        const items = links
          .filter(a => !q || (a.textContent || '').toLowerCase().includes(q))
          .slice(0, lim)
          .map(a => ({ title: (a.textContent || '').trim().slice(0, 80), url: a.href }));
        return JSON.stringify(items);
      })(${JSON.stringify(query)}, ${limit})
    `);

    let items: Array<{ title: string; url: string }> = [];
    try { items = JSON.parse(archived as string); } catch { /* ignore */ }
    if (!items.length) return [{ Title: 'No archived conversations found', Status: '' }];
    return items.map(item => ({ Title: item.title, Status: item.url }));
  },
});
