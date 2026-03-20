import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const newCommand = cli({
  site: 'gemini',
  name: 'new',
  description: 'Start a new Gemini conversation',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Status'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');
    await page.goto('https://gemini.google.com/app');
    await page.wait(2);
    // Click "New chat" button
    const clicked = await page.evaluate(`
      (function() {
        const btns = Array.from(document.querySelectorAll('button, a, [role="button"]'));
        const newBtn = btns.find(b => {
          const t = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase().trim();
          return t === 'new chat' || t.includes('new chat') || t === 'new conversation';
        });
        if (newBtn) { newBtn.click(); return true; }
        return false;
      })()
    `);
    if (!clicked) {
      // Fallback: navigate to fresh conversation URL
      await page.goto('https://gemini.google.com/app?new=1');
    }
    await page.wait(1);
    return [{ Status: 'New conversation started' }];
  },
});
