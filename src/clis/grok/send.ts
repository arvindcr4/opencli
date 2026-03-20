import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const sendCommand = cli({
  site: 'grok',
  name: 'send',
  description: 'Send a message to Grok without waiting for the response',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'prompt', required: true, positional: true, help: 'Message to send' },
  ],
  columns: ['Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const promptJson = JSON.stringify(kwargs.prompt as string);

    const result = await page.evaluate(`(async () => {
      const box = document.querySelector('textarea');
      if (!box) return 'no_textarea';
      box.focus(); box.value = '';
      document.execCommand('selectAll');
      document.execCommand('insertText', false, ${promptJson});
      await new Promise(r => setTimeout(r, 1000));
      const sub = [...document.querySelectorAll('button[type="submit"]')].find(b => !b.disabled);
      if (sub) { sub.click(); return 'sent'; }
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      return 'enter_pressed';
    })()`);

    return [{ Status: result === 'no_textarea' ? 'No textarea found' : 'Sent' }];
  },
});
