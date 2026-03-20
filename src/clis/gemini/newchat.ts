import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const newchatCommand = cli({
  site: 'gemini',
  name: 'newchat',
  description: 'Start a new Gemini conversation',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Status', 'URL'],
  func: async (page: IPage | null, _kwargs: any) => {
    if (!page) throw new Error('Browser page not available');

    const clicked = await page.evaluate(`
      (function() {
        const btn = document.querySelector('[aria-label*="New chat"]') ||
                    document.querySelector('[aria-label*="New conversation"]') ||
                    document.querySelector('[data-testid="new-conversation"]') ||
                    Array.from(document.querySelectorAll('button, a')).find(b =>
                      /new chat|new conversation/i.test(b.getAttribute('aria-label') || b.textContent || ''));
        if (btn) { btn.click(); return true; }
        return false;
      })()
    `);

    if (!clicked) {
      await page.goto('https://gemini.google.com/app');
    }
    await page.wait(800);
    const url = await page.evaluate(`window.location.href`) as string;
    return [{ Status: 'OK', URL: url }];
  },
});
