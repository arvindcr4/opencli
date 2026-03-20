import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const highlightCommand = cli({
  site: 'gemini',
  name: 'highlight',
  description: 'Search and find text within the current Gemini conversation',
  domain: 'gemini.google.com',
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
        const blocks = [
          ...Array.from(document.querySelectorAll('user-query')).map(el => ({ role: 'user', el })),
          ...Array.from(document.querySelectorAll('model-response')).map(el => ({ role: 'assistant', el })),
        ];
        for (const { role, el } of blocks) {
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
