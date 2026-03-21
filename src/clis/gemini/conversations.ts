import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const conversationsCommand = cli({
  site: 'gemini',
  name: 'conversations',
  description: 'List recent Gemini conversations from the sidebar',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'limit', type: 'int', default: 20, help: 'Max conversations to return' },
  ],
  columns: ['Index', 'Title', 'Url'],
  func: async (page: IPage, kwargs: Record<string, any>) => {
    const limit = (kwargs.limit as number) || 20;

    await page.goto('https://gemini.google.com/app');
    await page.wait(3);

    const conversations = await page.evaluate(`
      () => {
        const results = [];
        const limit = ${limit};

        const links = document.querySelectorAll(
          'a[href*="/app/"], .conversation-list a, nav a[href*="conversation"], .chat-history-item a'
        );

        const seen = new Set();
        links.forEach((link) => {
          if (results.length >= limit) return;
          const href = link.getAttribute('href') || '';
          const title = (link.textContent || '').trim();
          if (!href || seen.has(href) || !title || title.length < 2) return;
          seen.add(href);
          const url = href.startsWith('http') ? href : 'https://gemini.google.com' + href;
          results.push({ Index: results.length + 1, Title: title.substring(0, 100), Url: url });
        });

        return results;
      }
    `);

    if (!conversations || conversations.length === 0) {
      return [{ Index: 0, Title: 'No conversations found in sidebar', Url: '' }];
    }

    return conversations;
  },
});
