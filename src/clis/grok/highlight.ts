import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const highlightCommand = cli({
  site: 'grok',
  name: 'highlight',
  description: 'Search and find text within the current Grok conversation',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'query', required: true, positional: true, help: 'Text to search for' },
  ],
  columns: ['Match#', 'Role', 'Snippet'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const query = (kwargs.query as string).toLowerCase();

    const raw = await page.evaluate(`
      (function(q) {
        const results = [];
        let matchNum = 0;
        const allEls = Array.from(document.querySelectorAll('[data-testid="user-message"], [data-testid="message-bubble"], .user-message, .message-bubble'));
        for (const el of allEls) {
          const isUser = el.dataset?.testid === 'user-message' || el.classList.contains('user-message');
          const role = isUser ? 'user' : 'assistant';
          const text = (el.innerText || el.textContent || '').trim();
          const lower = text.toLowerCase();
          let idx = lower.indexOf(q);
          while (idx !== -1) {
            matchNum++;
            const start = Math.max(0, idx - 40);
            const end = Math.min(text.length, idx + q.length + 40);
            results.push({ num: matchNum, role, snippet: '…' + text.slice(start, end).trim() + '…' });
            idx = lower.indexOf(q, idx + 1);
          }
        }
        return JSON.stringify(results);
      })(${JSON.stringify(query)})
    `);

    let results: Array<{ num: number; role: string; snippet: string }> = [];
    try { results = JSON.parse(raw as string); } catch { /* ignore */ }
    if (!results.length) return [{ 'Match#': '0', Role: '-', Snippet: `No matches for "${query}"` }];
    return results.map(r => ({ 'Match#': String(r.num), Role: r.role, Snippet: r.snippet }));
  },
});
