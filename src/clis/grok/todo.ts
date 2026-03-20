import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const todoCommand = cli({
  site: 'grok',
  name: 'todo',
  description: 'Ask Grok to extract action items and to-dos from the conversation',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Status'],
  func: async (page: IPage | null, _kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const prompt = 'Please extract all action items, tasks, and to-dos from our conversation so far. Format each item as a checkbox: - [ ] task. Group them by priority if possible.';

    await page.evaluate(`
      (function(msg) {
        const el = document.querySelector('textarea, [contenteditable="true"]');
        if (el) { el.focus(); document.execCommand('selectAll'); document.execCommand('insertText', false, msg); }
      })(${JSON.stringify(prompt)})
    `);
    await page.wait(300);
    const sent = await page.evaluate(`
      (function() {
        const btn = document.querySelector('[aria-label*="Send"]') || document.querySelector('[data-testid="send-button"]');
        if (btn) { btn.click(); return true; }
        return false;
      })()
    `);
    if (!sent) await page.pressKey('Enter');
    return [{ Status: 'Sent: extracting action items' }];
  },
});
