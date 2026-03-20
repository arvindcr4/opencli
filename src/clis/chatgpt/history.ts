import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const historyCommand = cli({
  site: 'chatgpt',
  name: 'history',
  description: 'Read all messages in the current ChatGPT conversation (not just the last)',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    { name: 'limit', required: false, help: 'Max messages to show, newest first (default: all)', default: '0' },
    { name: 'role', required: false, help: 'Filter by role: user | assistant | all (default: all)', default: 'all' },
  ],
  columns: ['#', 'Role', 'Text'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const limit = parseInt(kwargs.limit as string, 10) || 0;
    const roleFilter = (kwargs.role as string) || 'all';

    const raw = await page.evaluate(`
      (function() {
        const turns = Array.from(document.querySelectorAll('[data-message-author-role]'));
        const messages = turns.map((el, i) => {
          const role = el.getAttribute('data-message-author-role') || 'unknown';
          const text = (el.innerText || el.textContent || '')
            .replace(/[\\uFFFC\\u200B-\\u200D\\uFEFF]/g, '')
            .trim();
          return { index: i + 1, role, text };
        });
        return JSON.stringify(messages);
      })()
    `);

    let messages: Array<{ index: number; role: string; text: string }> = [];
    try { messages = JSON.parse(raw); } catch { /* ignore */ }

    if (!messages.length) {
      return [{ '#': '-', Role: 'System', Text: 'No messages found in current conversation' }];
    }

    if (roleFilter !== 'all') {
      messages = messages.filter(m => m.role === roleFilter);
    }

    if (limit > 0) {
      messages = messages.slice(-limit);
    }

    return messages.map(m => ({
      '#': m.index,
      Role: m.role,
      Text: m.text.slice(0, 3000) + (m.text.length > 3000 ? '…' : ''),
    }));
  },
});
