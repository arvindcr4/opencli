import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const followupCommand = cli({
  site: 'chatgpt',
  name: 'followup',
  description: 'Send a quick follow-up message to the current ChatGPT conversation',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    { name: 'message', required: true, positional: true, help: 'Follow-up message to send' },
  ],
  columns: ['Status', 'Message'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const message = kwargs.message as string;

    const inputSel = '#prompt-textarea, [data-testid="prompt-textarea"], textarea[placeholder*="message"]';
    await page.click(inputSel);
    await page.evaluate(`
      (function(msg) {
        const el = document.querySelector('#prompt-textarea, [data-testid="prompt-textarea"], textarea');
        if (el) {
          el.focus();
          document.execCommand('selectAll');
          document.execCommand('insertText', false, msg);
        }
      })(${JSON.stringify(message)})
    `);
    await page.wait(300);
    await page.pressKey('Enter');
    return [{ Status: 'Sent', Message: message.slice(0, 80) }];
  },
});
