import { readFileSync } from 'node:fs';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import {
  COPILOT365_URL,
  FIND_INPUT_JS,
  FIND_SEND_BUTTON_JS,
  isCopilot365Url,
} from './_lib/shared.js';

export const sendCommand = cli({
  site: 'copilot365',
  name: 'send',
  description: 'Fire-and-forget: send a message to Microsoft 365 Copilot without waiting for the reply',
  domain: 'm365.cloud.microsoft',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'text', type: 'string', required: false, positional: true, help: 'Message text (or use --file)' },
    { name: 'file', type: 'string', required: false, help: 'Read message from this file' },
  ],
  columns: ['Status'],
  func: async (page: IPage, kwargs: Record<string, any>) => {
    const filePath = kwargs.file as string | undefined;
    const positional = kwargs.text as string | undefined;
    const text = filePath ? readFileSync(filePath, 'utf8').trim() : (positional ?? '').trim();
    if (!text) throw new Error('No message provided. Pass a positional string or --file <path>.');
    const promptJson = JSON.stringify(text);

    const currentUrl = await page.evaluate(`() => window.location.href`);
    if (!isCopilot365Url(currentUrl)) {
      await page.goto(COPILOT365_URL);
      await page.wait(5);
    }

    const result = await page.evaluate(`
      (async () => {
        try {
          ${FIND_INPUT_JS}
          ${FIND_SEND_BUTTON_JS}
          const editor = findCopilotInput();
          if (!editor) return { ok: false, msg: 'no Copilot input found' };

          editor.focus();
          if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
            editor.value = ${promptJson};
            editor.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(editor);
            sel.removeAllRanges();
            sel.addRange(range);
            document.execCommand('insertText', false, ${promptJson});
            editor.dispatchEvent(new Event('input', { bubbles: true }));
          }

          await new Promise(r => setTimeout(r, 500));

          const sendBtn = findCopilotSendButton();
          if (sendBtn && !sendBtn.disabled) {
            sendBtn.click();
            return { ok: true, msg: 'clicked-send' };
          }

          editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
          return { ok: true, msg: 'enter-key-fallback' };
        } catch (e) {
          return { ok: false, msg: String(e) };
        }
      })()
    `);

    if (!result || !result.ok) {
      return [{ Status: '[SEND FAILED] ' + JSON.stringify(result) }];
    }
    return [{ Status: 'Sent (' + result.msg + ')' }];
  },
});
