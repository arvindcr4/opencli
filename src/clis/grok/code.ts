import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const codeCommand = cli({
  site: 'grok',
  name: 'code',
  description: 'Ask Grok to write, review, or debug code',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  timeoutSeconds: 300,
  args: [
    { name: 'prompt', required: true, positional: true, help: 'Code task to perform' },
    { name: 'lang', required: false, help: 'Programming language hint (optional)' },
    { name: 'timeout', required: false, help: 'Max seconds to wait (default: 120)', default: '120' },
  ],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const lang = kwargs.lang as string | undefined;
    const prompt = kwargs.prompt as string;
    const fullPrompt = lang ? `[${lang}] ${prompt}` : prompt;
    const timeout = parseInt(kwargs.timeout as string, 10) || 120;
    const promptJson = JSON.stringify(fullPrompt);

    await page.goto('https://grok.com');
    await page.wait(3);

    const sendResult = await page.evaluate(`(async () => {
      const box = document.querySelector('textarea');
      if (!box) return 'no_textarea';
      box.focus(); box.value = '';
      document.execCommand('selectAll');
      document.execCommand('insertText', false, ${promptJson});
      await new Promise(r => setTimeout(r, 1000));
      const sub = [...document.querySelectorAll('button[type="submit"]')].find(b => !b.disabled);
      if (sub) { sub.click(); return 'sent'; }
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      return 'enter';
    })()`);

    if (sendResult === 'no_textarea') return [{ Role: 'System', Text: 'No textarea found' }];

    const deadline = Date.now() + timeout * 1000;
    let lastText = '';
    let stableCount = 0;

    while (Date.now() - Date.now() + deadline > 0 && Date.now() < deadline) {
      await page.wait(3);
      const response = await page.evaluate(`
        (function() {
          const bubbles = document.querySelectorAll('div.message-bubble, [data-testid="message-bubble"]');
          if (bubbles.length < 2) return '';
          const last = bubbles[bubbles.length - 1];
          return (last.innerText || '').trim();
        })()
      `) as string;

      if (response && response.length > 5) {
        if (response === lastText) {
          stableCount++;
          if (stableCount >= 2) return [{ Role: 'User', Text: fullPrompt }, { Role: 'Assistant', Text: response }];
        } else { stableCount = 0; }
      }
      lastText = response || '';
    }

    return [{ Role: 'System', Text: `Timeout — partial: ${lastText.slice(0, 100)}` }];
  },
});
