import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const expandCommand = cli({
  site: 'chatgpt',
  name: 'expand',
  description: 'Ask ChatGPT to expand and elaborate on its last response',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    { name: 'focus', required: false, positional: true, help: 'Specific aspect to expand on (optional)' },
  ],
  columns: ['Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const focus = kwargs.focus as string | undefined;
    const prompt = focus
      ? `Please expand on your previous response, focusing specifically on: ${focus}. Provide more detail, examples, and deeper analysis.`
      : 'Please expand on your previous response. Provide more detail, examples, and deeper analysis on the key points.';

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
    return [{ Status: 'Sent: expanding response' }];
  },
});
