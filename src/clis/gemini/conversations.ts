import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const conversationsCommand = cli({
  site: 'gemini',
  name: 'conversations',
  description: 'List Gemini conversations; optionally navigate to one by index',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'index', required: false, positional: true, help: 'Conversation index to navigate to (1-based)' },
    { name: 'limit', required: false, help: 'Max conversations to show (default: 20)', default: '20' },
  ],
  columns: ['#', 'Title', 'Active'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const limit = parseInt(kwargs.limit as string, 10) || 20;

    const raw = await page.evaluate(`
      (function() {
        const links = Array.from(document.querySelectorAll(
          'nav a[href*="/app/"], aside a[href*="/app/"], a[href*="gemini.google.com/app/"]'
        ));
        const seen = new Set();
        const convs = [];
        for (const el of links) {
          const href = el.getAttribute('href') || '';
          if (!href || seen.has(href)) continue;
          seen.add(href);
          const title = (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 100);
          const active = el.getAttribute('aria-current') === 'page' || window.location.href.includes(href);
          convs.push({ index: convs.length + 1, title, href, active });
        }
        return JSON.stringify(convs);
      })()
    `);

    let convs: Array<{ index: number; title: string; href: string; active: boolean }> = [];
    try { convs = JSON.parse(raw); } catch { /* ignore */ }

    if (!convs.length) return [{ '#': '-', Title: 'No conversations found in sidebar', Active: '' }];

    const idx = kwargs.index ? parseInt(kwargs.index as string, 10) : null;
    if (idx !== null) {
      const conv = convs[idx - 1];
      if (!conv) throw new Error(`Conversation ${idx} not found`);
      const url = conv.href.startsWith('http') ? conv.href : `https://gemini.google.com${conv.href}`;
      await page.goto(url);
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
