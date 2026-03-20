import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const newchatCommand = cli({
  site: 'chatgpt',
  name: 'newchat',
  description: 'Start a new ChatGPT conversation',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [],
  columns: ['Status', 'URL'],
  func: async (page: IPage | null, _kwargs: any) => {
    if (!page) throw new Error('Browser page not available');

    // Try new chat button
    const clicked = await page.evaluate(`
      (function() {
        const btn = document.querySelector('[aria-label*="New chat"]') ||
                    document.querySelector('[data-testid="new-chat-button"]') ||
                    document.querySelector('a[href="/"]') ||
                    Array.from(document.querySelectorAll('button, a')).find(b =>
                      /new chat/i.test(b.getAttribute('aria-label') || b.textContent || ''));
        if (btn) { btn.click(); return true; }
        return false;
      })()
    `);

    if (!clicked) {
      await page.goto('https://chatgpt.com/');
    }
    await page.wait(800);
    const url = await page.evaluate(`window.location.href`) as string;
    return [{ Status: 'OK', URL: url }];
  },
});
