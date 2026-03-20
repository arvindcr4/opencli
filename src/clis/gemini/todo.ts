import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const todoCommand = cli({
  site: 'gemini',
  name: 'todo',
  description: 'Ask Gemini to extract action items and to-dos from the conversation',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Status'],
  func: async (page: IPage | null, _kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const prompt = 'Please extract all action items, tasks, and to-dos from our conversation so far. Format each item as a checkbox: - [ ] task. Group them by priority if possible.';

    await page.evaluate(`
      (function(msg) {
        const el = document.querySelector('rich-textarea [contenteditable], .ql-editor, textarea');
        if (el) { el.focus(); document.execCommand('selectAll'); document.execCommand('insertText', false, msg); }
      })(${JSON.stringify(prompt)})
    `);
    await page.wait(300);
    const sent = await page.evaluate(`
      (function() {
        const btn = document.querySelector('button[aria-label*="Send"]') || document.querySelector('[data-testid="send-button"]');
        if (btn) { btn.click(); return true; }
        return false;
      })()
    `);
    if (!sent) await page.pressKey('Enter');
    return [{ Status: 'Sent: extracting action items' }];
  },
});
