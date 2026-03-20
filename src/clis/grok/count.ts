import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const countCommand = cli({
  site: 'grok',
  name: 'count',
  description: 'Count messages in the current grok conversation',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Total', 'User', 'Assistant'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');

    const counts = await page.evaluate(`
      (function() {
        const all = document.querySelectorAll('[data-testid="message-bubble"],div.message-bubble');
        const user = Array.from(all).filter(el =>
          el.getAttribute('data-message-author-role') === 'user' ||
          el.tagName.toLowerCase().includes('user') ||
          el.classList.contains('user-message') ||
          el.getAttribute('data-testid') === 'user-message'
        ).length;
        return { total: all.length, user, assistant: all.length - user };
      })()
    `) as { total: number; user: number; assistant: number };

    return [{ Total: String(counts.total), User: String(counts.user), Assistant: String(counts.assistant) }];
  },
});
