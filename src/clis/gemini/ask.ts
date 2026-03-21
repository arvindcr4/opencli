import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const askCommand = cli({
  site: 'gemini',
  name: 'ask',
  description: 'Send a prompt to Gemini and wait for the response',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'prompt', type: 'string', required: true, positional: true, help: 'Prompt to send' },
    { name: 'timeout', type: 'int', default: 120, help: 'Max seconds to wait (default: 120)' },
    { name: 'new', type: 'boolean', default: false, help: 'Start a new conversation first' },
  ],
  columns: ['Role', 'Text'],
  timeoutSeconds: 180,
  func: async (page: IPage, kwargs: Record<string, any>) => {
    const prompt = kwargs.prompt as string;
    const timeoutMs = ((kwargs.timeout as number) || 120) * 1000;
    const newChat = kwargs.new as boolean;
    const promptJson = JSON.stringify(prompt);

    // Navigate only if not already on Gemini
    const currentUrl = await page.evaluate(`() => window.location.href`);
    if (!currentUrl || !String(currentUrl).includes('gemini.google.com')) {
      await page.goto('https://gemini.google.com/app');
      await page.wait(4);
    } else if (newChat) {
      await page.goto('https://gemini.google.com/app');
      await page.wait(4);
    } else {
      await page.wait(1);
    }

    // Count existing model-response turns
    const beforeCount = await page.evaluate(`
      () => document.querySelectorAll('model-response').length
    `);

    // Type into the Quill editor and click Send
    const sendResult = await page.evaluate(`
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

    if (!sendResult || !sendResult.ok) {
      return [
        { Role: 'User', Text: prompt },
        { Role: 'System', Text: '[SEND FAILED] ' + JSON.stringify(sendResult) },
      ];
    }

    // Poll for new response
    const startTime = Date.now();
    let lastText = '';
    let stableCount = 0;

    while (Date.now() - startTime < timeoutMs) {
      await page.wait(3);

      const response = await page.evaluate(`
        () => {
          const responses = document.querySelectorAll('model-response');
          if (responses.length <= ${beforeCount}) return '';
          const last = responses[responses.length - 1];
          let text = (last.innerText || last.textContent || '').trim();
          if (!text || text.length < 2) return '';
          // Strip "Gemini said" accessibility prefix
          text = text.replace(/^(Show thinking|Hide thinking)\s*/i, '').trim();
          text = text.replace(/^Gemini said\s*/i, '').trim();
          return text;
        }
      `);

      if (response && response.length > 2) {
        if (response === lastText) {
          stableCount++;
          if (stableCount >= 2) {
            return [
              { Role: 'User', Text: prompt },
              { Role: 'Gemini', Text: response },
            ];
          }
        } else {
          stableCount = 0;
        }
        lastText = response;
      }
    }

    if (lastText) {
      return [
        { Role: 'User', Text: prompt },
        { Role: 'Gemini', Text: lastText },
      ];
    }

    return [
      { Role: 'User', Text: prompt },
      { Role: 'System', Text: `No response within ${timeoutMs / 1000}s` },
    ];
  },
});
