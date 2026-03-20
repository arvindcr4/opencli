import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const urlCommand = cli({
  site: 'chatgpt',
  name: 'url',
  description: 'Get the current chatgpt conversation URL',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [],
  columns: ['URL', 'Title'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');

    const info = await page.evaluate(`
      JSON.stringify({ url: location.href, title: document.title.replace(' - chatgpt.com', '').trim() })
    `) as string;

    let result = { url: '', title: '' };
    try { result = JSON.parse(info); } catch { /* ignore */ }
    return [{ URL: result.url, Title: result.title }];
  },
});
