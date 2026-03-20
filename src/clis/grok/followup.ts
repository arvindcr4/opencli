import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const followupCommand = cli({
  site: 'grok',
  name: 'followup',
  description: 'Send a quick follow-up message to the current Grok conversation',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'message', required: true, positional: true, help: 'Follow-up message to send' },
  ],
  columns: ['Status', 'Message'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const message = kwargs.message as string;

    await page.evaluate(`
      (function(msg) {
        const el = document.querySelector('textarea, [contenteditable="true"]');
        if (el) {
          el.focus();
          document.execCommand('selectAll');
          document.execCommand('insertText', false, msg);
        }
      })(${JSON.stringify(message)})
    `);
    await page.wait(300);

    const sent = await page.evaluate(`
      (function() {
        const btn = document.querySelector('[aria-label*="Send"]') ||
                    document.querySelector('[data-testid="send-button"]');
        if (btn) { btn.click(); return true; }
        return false;
      })()
    `);

    if (!sent) await page.pressKey('Enter');
    return [{ Status: 'Sent', Message: message.slice(0, 80) }];
  },
});
