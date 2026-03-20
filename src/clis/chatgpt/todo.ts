import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const todoCommand = cli({
  site: 'chatgpt',
  name: 'todo',
  description: 'Ask ChatGPT to extract action items and to-dos from the conversation',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [],
  columns: ['Status'],
  func: async (page: IPage | null, _kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const prompt = 'Please extract all action items, tasks, and to-dos from our conversation so far. Format each item as a checkbox: - [ ] task. Group them by priority if possible.';

    const inputSel = '#prompt-textarea, [data-testid="prompt-textarea"]';
    await page.click(inputSel);
    await page.evaluate(`
      (function(msg) {
        const el = document.querySelector('#prompt-textarea, [data-testid="prompt-textarea"], textarea');
        if (el) { el.focus(); document.execCommand('selectAll'); document.execCommand('insertText', false, msg); }
      })(${JSON.stringify(prompt)})
    `);
    await page.wait(300);
    await page.pressKey('Enter');
    return [{ Status: 'Sent: extracting action items' }];
  },
});
