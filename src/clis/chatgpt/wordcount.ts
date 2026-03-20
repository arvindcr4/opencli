import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const wordcountCommand = cli({
  site: 'chatgpt',
  name: 'wordcount',
  description: 'Show word and character statistics for the current ChatGPT conversation',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [],
  columns: ['Role', 'Messages', 'Words', 'Characters'],
  func: async (page: IPage | null, _kwargs: any) => {
    if (!page) throw new Error('Browser page not available');

    const raw = await page.evaluate(`
      (function() {
        const turns = Array.from(document.querySelectorAll('[data-message-author-role]'));
        const stats = { user: { msgs: 0, words: 0, chars: 0 }, assistant: { msgs: 0, words: 0, chars: 0 } };
        for (const el of turns) {
          const role = el.getAttribute('data-message-author-role') || 'assistant';
          const text = (el.innerText || el.textContent || '').replace(/[\\uFFFC\\u200B-\\u200D\\uFEFF]/g, '').trim();
          const key = role === 'user' ? 'user' : 'assistant';
          stats[key].msgs++;
          stats[key].words += text.split(/\\s+/).filter(Boolean).length;
          stats[key].chars += text.length;
        }
        return JSON.stringify(stats);
      })()
    `);

    let stats: { user: { msgs: number; words: number; chars: number }; assistant: { msgs: number; words: number; chars: number } };
    try { stats = JSON.parse(raw as string); }
    catch { return [{ Role: 'Error', Messages: '0', Words: '0', Characters: '0' }]; }

    const total = {
      msgs: stats.user.msgs + stats.assistant.msgs,
      words: stats.user.words + stats.assistant.words,
      chars: stats.user.chars + stats.assistant.chars,
    };

    return [
      { Role: 'user', Messages: String(stats.user.msgs), Words: String(stats.user.words), Characters: String(stats.user.chars) },
      { Role: 'assistant', Messages: String(stats.assistant.msgs), Words: String(stats.assistant.words), Characters: String(stats.assistant.chars) },
      { Role: 'TOTAL', Messages: String(total.msgs), Words: String(total.words), Characters: String(total.chars) },
    ];
  },
});
