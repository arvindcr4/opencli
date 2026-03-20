import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const wordcountCommand = cli({
  site: 'gemini',
  name: 'wordcount',
  description: 'Show word and character statistics for the current Gemini conversation',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Role', 'Messages', 'Words', 'Characters'],
  func: async (page: IPage | null, _kwargs: any) => {
    if (!page) throw new Error('Browser page not available');

    const raw = await page.evaluate(`
      (function() {
        const stats = { user: { msgs: 0, words: 0, chars: 0 }, assistant: { msgs: 0, words: 0, chars: 0 } };
        for (const el of document.querySelectorAll('user-query')) {
          const text = (el.innerText || el.textContent || '').trim();
          stats.user.msgs++;
          stats.user.words += text.split(/\\s+/).filter(Boolean).length;
          stats.user.chars += text.length;
        }
        for (const el of document.querySelectorAll('model-response')) {
          const text = (el.innerText || el.textContent || '').trim();
          stats.assistant.msgs++;
          stats.assistant.words += text.split(/\\s+/).filter(Boolean).length;
          stats.assistant.chars += text.length;
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
