import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const historyCommand = cli({
  site: 'grok',
  name: 'history',
  description: 'Read all messages in the current Grok conversation',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'role', required: false, help: 'Filter by role: user | assistant | all (default: all)', default: 'all' },
    { name: 'limit', required: false, help: 'Max messages to show (default: all)', default: '0' },
  ],
  columns: ['#', 'Role', 'Text'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const roleFilter = (kwargs.role as string) || 'all';
    const limit = parseInt(kwargs.limit as string, 10) || 0;

    const raw = await page.evaluate(`
      (function() {
        const messages = [];
        // Grok alternates user/assistant message bubbles
        const userBubbles = Array.from(document.querySelectorAll('[data-testid="user-message"], .user-message, .human-message'));
        const aiBubbles = Array.from(document.querySelectorAll('[data-testid="message-bubble"], .message-bubble, .ai-message, div.message-bubble'));

        // Collect all turns in DOM order
        const allEls = Array.from(document.querySelectorAll(
          '[data-testid="user-message"], [data-testid="message-bubble"], .user-message, .message-bubble'
        ));

        for (const el of allEls) {
          const isUser = el.dataset?.testid === 'user-message' || el.classList.contains('user-message') || el.classList.contains('human-message');
          const role = isUser ? 'user' : 'assistant';
          const text = (el.innerText || el.textContent || '').replace(/[\\uFFFC\\u200B-\\u200D\\uFEFF]/g, '').trim();
          if (text) messages.push({ role, text });
        }
        return JSON.stringify(messages);
      })()
    `);

    let messages: Array<{ role: string; text: string }> = [];
    try { messages = JSON.parse(raw); } catch { /* ignore */ }

    if (!messages.length) return [{ '#': '-', Role: 'System', Text: 'No messages found' }];

    if (roleFilter !== 'all') messages = messages.filter(m => m.role === roleFilter);
    if (limit > 0) messages = messages.slice(-limit);

    return messages.map((m, i) => ({
      '#': i + 1,
      Role: m.role,
      Text: m.text.slice(0, 3000) + (m.text.length > 3000 ? '…' : ''),
    }));
  },
});
