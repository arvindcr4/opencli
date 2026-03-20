import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { getLastClaudeResponse, isClaudeGenerating } from './ax.js';

export const waitCommand = cli({
  site: 'claude',
  name: 'wait',
  description: 'Wait for Claude.ai to finish generating, then return the response',
  domain: 'claude.ai',
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
      if (await isClaudeGenerating(page)) { stableCount = 0; continue; }
      const cur = await getLastClaudeResponse(page);
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
