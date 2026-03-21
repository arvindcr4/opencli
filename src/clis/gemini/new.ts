import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const newCommand = cli({
  site: 'gemini',
  name: 'new',
  description: 'Start a new conversation in Google Gemini',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Status'],
  func: async (page: IPage) => {
    await page.goto('https://gemini.google.com/app');
    await page.wait(3);

    await page.evaluate(`
      () => {
        const btn = [...document.querySelectorAll('a, button')].find(b => {
          const t = (b.textContent || '').trim().toLowerCase();
          return t.includes('new chat') || t.includes('new conversation');
        });
        if (btn) btn.click();
      }
    `);

    return [{ Status: 'New conversation started' }];
  },
});
