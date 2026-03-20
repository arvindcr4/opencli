import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

async function isGrokGenerating(page: IPage): Promise<boolean> {
  const result = await page.evaluate(`
    (function() {
      if (document.querySelector('[data-testid="stop-button"], [aria-label*="Stop"]')) return true;
      const btns = Array.from(document.querySelectorAll('button'));
      if (btns.some(b => /stop/i.test(b.textContent || b.getAttribute('aria-label') || ''))) return true;
      if (document.querySelector('.typing-indicator, [class*="typing"], [class*="generating"]')) return true;
      return false;
    })()
  `);
  return !!result;
}

async function getLastGrokResponse(page: IPage): Promise<string> {
  const result = await page.evaluate(`
    (function() {
      const bubbles = Array.from(document.querySelectorAll('div.message-bubble, [data-testid="message-bubble"]'));
      if (!bubbles.length) return '';
      return (bubbles[bubbles.length - 1].innerText || '').trim();
    })()
  `);
  return (result as string) || '';
}

export const waitCommand = cli({
  site: 'grok',
  name: 'wait',
  description: 'Wait for Grok to finish generating, then return the response',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  timeoutSeconds: 600,
  args: [
    { name: 'timeout', required: false, help: 'Max seconds to wait (default: 300)', default: '300' },
  ],
  columns: ['Status', 'Text'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const timeout = parseInt(kwargs.timeout as string, 10) || 300;
    const deadline = Date.now() + timeout * 1000;
    let prev = '';
    let stableCount = 0;

    while (Date.now() < deadline) {
      await page.wait(2);
      if (await isGrokGenerating(page)) { stableCount = 0; continue; }
      const cur = await getLastGrokResponse(page);
      if (cur.length > 10) {
        if (cur === prev) {
          stableCount++;
          if (stableCount >= 2) return [{ Status: 'Complete', Text: cur }];
        } else {
          stableCount = 0; prev = cur;
        }
      }
    }
    return [{ Status: `Timeout after ${timeout}s`, Text: '' }];
  },
});
