import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

async function isGrokGenerating(page: IPage): Promise<boolean> {
  const result = await page.evaluate(`
    (function() {
      const stop = document.querySelector('[data-testid="stop-button"], button[aria-label*="Stop"]');
      if (stop) return true;
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => /stop/i.test(b.getAttribute('aria-label') || b.textContent || ''));
    })()
  `);
  return !!result;
}

export const pollCommand = cli({
  site: 'grok',
  name: 'poll',
  description: 'Poll until Grok finishes generating, then return the full response',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  timeoutSeconds: 7200,
  args: [
    { name: 'timeout', required: false, help: 'Max seconds to poll (default: 3600)', default: '3600' },
    { name: 'interval', required: false, help: 'Poll interval in seconds (default: 3)', default: '3' },
    { name: 'min_length', required: false, help: 'Minimum response length (default: 10)', default: '10' },
  ],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const timeout = parseInt(kwargs.timeout as string, 10) || 3600;
    const interval = parseInt(kwargs.interval as string, 10) || 3;
    const minLength = parseInt(kwargs.min_length as string, 10) || 10;

    const deadline = Date.now() + timeout * 1000;
    let prev = '';
    let stableCount = 0;

    while (Date.now() < deadline) {
      await page.wait(interval);
      if (await isGrokGenerating(page)) { stableCount = 0; continue; }

      const cur = await page.evaluate(`
        (function() {
          const bubbles = document.querySelectorAll('div.message-bubble, [data-testid="message-bubble"]');
          if (!bubbles.length) return '';
          const last = bubbles[bubbles.length - 1];
          return (last.innerText || '').trim();
        })()
      `) as string;

      if (cur && cur.length >= minLength) {
        if (cur === prev) {
          stableCount++;
          if (stableCount >= 2) return [{ Role: 'Assistant', Text: cur }];
        } else {
          stableCount = 0;
          prev = cur;
        }
      }
    }
    return [{ Role: 'System', Text: `Timeout after ${timeout}s` }];
  },
});
