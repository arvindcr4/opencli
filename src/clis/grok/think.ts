import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const thinkCommand = cli({
  site: 'grok',
  name: 'think',
  description: 'Submit a query to Grok using Think/reasoning mode',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  timeoutSeconds: 600,
  args: [
    { name: 'query', required: true, positional: true, help: 'Query for Grok Think mode' },
    { name: 'timeout', required: false, help: 'Max seconds to wait (default: 300)', default: '300' },
  ],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const query = kwargs.query as string;
    const timeout = parseInt(kwargs.timeout as string, 10) || 300;

    await page.goto('https://grok.com');
    await page.wait(3);

    // Enable Think mode toggle
    await page.evaluate(`
      (function() {
        const toggles = Array.from(document.querySelectorAll('button, [role="switch"], label'));
        const thinkToggle = toggles.find(el => {
          const t = (el.textContent || el.getAttribute('aria-label') || '').toLowerCase();
          return t === 'think' || t.includes('reasoning') || t.includes('think');
        });
        if (thinkToggle && thinkToggle.getAttribute('aria-checked') !== 'true') thinkToggle.click();
      })()
    `);
    await page.wait(1);

    const promptJson = JSON.stringify(query);
    const sendResult = await page.evaluate(`(async () => {
      try {
        const box = document.querySelector('textarea');
        if (!box) return { ok: false };
        box.focus(); box.value = '';
        document.execCommand('selectAll');
        document.execCommand('insertText', false, ${promptJson});
        await new Promise(r => setTimeout(r, 1500));
        const sub = [...document.querySelectorAll('button[type="submit"]')].find(b => !b.disabled);
        if (sub) { sub.click(); return { ok: true }; }
        box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        return { ok: true };
      } catch (e) { return { ok: false }; }
    })()`);

    if (!sendResult?.ok) return [{ Role: 'System', Text: 'Failed to send query' }];

    const deadline = Date.now() + timeout * 1000;
    let lastText = '';
    let stableCount = 0;

    while (Date.now() < deadline) {
      await page.wait(4);
      const response = await page.evaluate(`(() => {
        const bubbles = document.querySelectorAll('div.message-bubble, [data-testid="message-bubble"]');
        if (bubbles.length < 2) return '';
        const last = bubbles[bubbles.length - 1];
        return (last.innerText || '').trim();
      })()`);

      const generating = await page.evaluate(`(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.some(b => /stop/i.test(b.textContent || ''));
      })()`);

      if (response && response.length > 20) {
        if (response === lastText && !generating) {
          stableCount++;
          if (stableCount >= 2) return [{ Role: 'User', Text: query }, { Role: 'Assistant', Text: response }];
        } else {
          stableCount = 0;
        }
      }
      lastText = response || '';
    }

    if (lastText) return [{ Role: 'User', Text: query }, { Role: 'Assistant', Text: lastText }];
    return [{ Role: 'System', Text: `No response within ${timeout}s` }];
  },
});
