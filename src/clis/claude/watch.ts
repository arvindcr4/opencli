import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const watchCommand = cli({
  site: 'claude',
  name: 'watch',
  description: 'Watch the current Claude.ai response until it finishes generating',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'timeout', required: false, help: 'Max seconds to wait (default: 120)', default: '120' },
  ],
  columns: ['Status', 'Length', 'Elapsed'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const maxMs = parseInt(kwargs.timeout as string || '120', 10) * 1000;
    const start = Date.now();

    const isGenerating = async (): Promise<boolean> => {
      const result = await page.evaluate(`
        !!(document.querySelector('[aria-label="Stop"]') ||
           document.querySelector('[data-is-streaming="true"]') ||
           document.querySelector('.streaming-indicator'))
      `);
      return result as boolean;
    };

    const getLastText = async (): Promise<string> => {
      const result = await page.evaluate(`
        (function() {
          const msgs = document.querySelectorAll('[data-testid="assistant-message"], .assistant-message');
          const last = msgs[msgs.length - 1];
          return last ? (last.innerText || last.textContent || '').trim() : '';
        })()
      `);
      return result as string;
    };

    let stableCount = 0;
    let lastText = '';
    while (Date.now() - start < maxMs) {
      const generating = await isGenerating();
      const text = await getLastText();
      if (!generating && text === lastText && text.length > 0) {
        stableCount++;
        if (stableCount >= 2) {
          const elapsed = ((Date.now() - start) / 1000).toFixed(1);
          return [{ Status: 'Done', Length: String(text.length), Elapsed: `${elapsed}s` }];
        }
      } else {
        stableCount = 0;
      }
      lastText = text;
      await page.wait(1000);
    }
    const text = await getLastText();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    return [{ Status: 'Timeout', Length: String(text.length), Elapsed: `${elapsed}s` }];
  },
});
