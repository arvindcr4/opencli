import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const conversationsCommand = cli({
  site: 'chatgpt',
  name: 'conversations',
  description: 'List ChatGPT conversations from sidebar; optionally navigate to one by index',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    { name: 'index', required: false, positional: true, help: 'Conversation index to navigate to (1-based)' },
    { name: 'limit', required: false, help: 'Max conversations to list (default: 20)', default: '20' },
  ],
  columns: ['#', 'Title', 'Active'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const limit = parseInt(kwargs.limit as string, 10) || 20;

    const raw = await page.evaluate(`
      (function() {
        // Try multiple selectors for conversation links
        const items = Array.from(
          document.querySelectorAll('nav a[href*="/c/"], ol li a[href*="/c/"], [data-testid*="conversation"] a')
        );
        const seen = new Set();
        const convs = [];
        for (let i = 0; i < items.length; i++) {
          const el = items[i];
          const href = el.getAttribute('href') || '';
          if (!href || seen.has(href)) continue;
          seen.add(href);
          const title = (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 100);
          const active = el.getAttribute('aria-current') === 'page' ||
            window.location.pathname === href ||
            el.closest('[aria-selected="true"]') !== null;
          convs.push({ index: convs.length + 1, title, href, active });
        }
        return JSON.stringify(convs);
      })()
    `);

    let convs: Array<{ index: number; title: string; href: string; active: boolean }> = [];
    try { convs = JSON.parse(raw); } catch { /* ignore */ }

    if (!convs.length) {
      return [{ '#': '-', Title: 'No conversations found in sidebar (make sure chatgpt.com is open)', Active: '' }];
    }

    const idx = kwargs.index ? parseInt(kwargs.index as string, 10) : null;
    if (idx !== null) {
      const conv = convs[idx - 1];
      if (!conv) throw new Error(`Conversation ${idx} not found (only ${convs.length} available)`);
      await page.goto(`https://chatgpt.com${conv.href}`);
      await page.wait(2);
      return [{ '#': idx, Title: conv.title, Active: 'navigated' }];
    }

    return convs.slice(0, limit).map(c => ({
      '#': c.index,
      Title: c.title || '(untitled)',
      Active: c.active ? '✓' : '',
    }));
  },
});
