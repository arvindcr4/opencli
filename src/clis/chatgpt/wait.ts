import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

async function checkGenerating(page: IPage): Promise<boolean> {
  const result = await page.evaluate(`
    (function() {
      // Stop button present = still generating
      if (document.querySelector('[data-testid="stop-button"]')) return true;
      // Any "Stop generating" / "Stop" button
      const btns = Array.from(document.querySelectorAll('button'));
      if (btns.some(b => /^stop/i.test((b.textContent || b.getAttribute('aria-label') || '').trim()))) return true;
      return false;
    })()
  `);
  return !!result;
}

export const waitCommand = cli({
  site: 'chatgpt',
  name: 'wait',
  description: 'Wait for the current ChatGPT generation to complete, then return the response',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  timeoutSeconds: 600,
  args: [
    { name: 'timeout', required: false, help: 'Max seconds to wait (default: 300)', default: '300' },
    { name: 'read', required: false, help: 'Print the response after waiting (true/false, default: true)', default: 'true' },
  ],
  columns: ['Status', 'Text'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const timeout = parseInt(kwargs.timeout as string, 10) || 300;
    const shouldRead = kwargs.read !== 'false';
    const deadline = Date.now() + timeout * 1000;

    const wasGenerating = await checkGenerating(page);
    if (!wasGenerating) {
      if (!shouldRead) return [{ Status: 'Already idle', Text: '' }];
      // Read last response
      const raw = await page.evaluate(`
        (function() {
          const turns = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
          if (!turns.length) return '';
          const last = turns[turns.length - 1];
          return (last.innerText || last.textContent || '').replace(/[\\uFFFC\\u200B-\\u200D\\uFEFF]/g, '').trim();
        })()
      `);
      return [{ Status: 'Already idle', Text: (raw as string) || '' }];
    }

    while (Date.now() < deadline) {
      await page.wait(2);
      if (!(await checkGenerating(page))) {
        // Stable check — wait a bit more to ensure streaming finished
        await page.wait(2);
        if (!(await checkGenerating(page))) {
          if (!shouldRead) return [{ Status: 'Complete', Text: '' }];
          const raw = await page.evaluate(`
            (function() {
              const turns = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
              if (!turns.length) return '';
              const last = turns[turns.length - 1];
              return (last.innerText || last.textContent || '').replace(/[\\uFFFC\\u200B-\\u200D\\uFEFF]/g, '').trim();
            })()
          `);
          return [{ Status: 'Complete', Text: (raw as string) || '' }];
        }
      }
    }

    return [{ Status: `Timeout after ${timeout}s — still generating`, Text: '' }];
  },
});
