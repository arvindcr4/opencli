import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const statusCommand = cli({
  site: 'gemini',
  name: 'status',
  description: 'Check active CDP connection to Google Gemini',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Status', 'Url', 'Title', 'Model'],
  func: async (page: IPage) => {
    await page.goto('https://gemini.google.com');
    await page.wait(3);

    const info = await page.evaluate(`
      () => {
        const title = document.title || '';
        const url = window.location.href;
        const modeBtn = document.querySelector('button[aria-label="Open mode picker"]');
        const model = modeBtn ? (modeBtn.textContent || '').trim() : 'unknown';
        return { title, url, model };
      }
    `);

    return [{
      Status: 'Connected',
      Url: info.url,
      Title: info.title,
      Model: info.model,
    }];
  },
});
