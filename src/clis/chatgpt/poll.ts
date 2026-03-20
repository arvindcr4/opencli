import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { getVisibleChatMessagesFromPage } from './ax.js';

async function isGenerating(page: IPage): Promise<boolean> {
  const result = await page.evaluate(`
    (function() {
      if (document.querySelector('[data-testid="stop-button"]')) return true;
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => /^stop/i.test((b.textContent || b.getAttribute('aria-label') || '').trim()));
    })()
  `);
  return !!result;
}

export const pollCommand = cli({
  site: 'chatgpt',
  name: 'poll',
  description: 'Poll until ChatGPT finishes generating, then return the full response',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  timeoutSeconds: 7200,
  args: [
    { name: 'timeout', required: false, help: 'Max seconds to poll (default: 3600)', default: '3600' },
    { name: 'interval', required: false, help: 'Poll interval in seconds (default: 3)', default: '3' },
    { name: 'min_length', required: false, help: 'Minimum response length to accept (default: 10)', default: '10' },
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

      const generating = await isGenerating(page);
      if (generating) {
        stableCount = 0;
        continue;
      }

      // Not generating — check for stable response
      const messages = await getVisibleChatMessagesFromPage(page);
      const latest = messages[messages.length - 1] ?? '';

      if (latest.length >= minLength) {
        if (latest === prev) {
          stableCount++;
          if (stableCount >= 2) {
            return [{ Role: 'Assistant', Text: latest }];
          }
        } else {
          stableCount = 0;
          prev = latest;
        }
      }
    }

    return [{ Role: 'System', Text: `Timeout after ${timeout}s — ChatGPT may still be generating` }];
  },
});
