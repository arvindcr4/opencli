import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const sendCommand = cli({
  site: 'gemini',
  name: 'send',
  description: 'Send a message to Google Gemini',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'text', type: 'string', required: true, positional: true, help: 'Message to send' },
  ],
  columns: ['Status'],
  func: async (page: IPage, kwargs: Record<string, any>) => {
    const text = kwargs.text as string;
    const promptJson = JSON.stringify(text);

    await page.goto('https://gemini.google.com');
    await page.wait(4);

    const result = await page.evaluate(`
      async () => {
        try {
          const editor = document.querySelector('.ql-editor[aria-label*="prompt"], .ql-editor[contenteditable="true"]');
          if (!editor) return { ok: false, msg: 'no ql-editor found' };

          editor.focus();
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editor);
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand('insertText', false, ${promptJson});

          await new Promise(r => setTimeout(r, 500));

          const sendBtn = document.querySelector('button[aria-label="Send message"]');
          if (sendBtn && !sendBtn.disabled) {
            sendBtn.click();
            return { ok: true, msg: 'clicked-send' };
          }

          return { ok: false, msg: 'send button not found or disabled' };
        } catch (e) {
          return { ok: false, msg: e.toString() };
        }
      }
    `);

    if (!result || !result.ok) {
      return [{ Status: '[SEND FAILED] ' + JSON.stringify(result) }];
    }

    return [{ Status: 'Sent' }];
  },
});
