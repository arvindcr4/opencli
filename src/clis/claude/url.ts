import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const urlCommand = cli({
  site: 'claude',
  name: 'url',
  description: 'Get the current claude conversation URL',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['URL', 'Title'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');

    const info = await page.evaluate(`
      JSON.stringify({ url: location.href, title: document.title.replace(' - claude.ai', '').trim() })
    `) as string;

    let result = { url: '', title: '' };
    try { result = JSON.parse(info); } catch { /* ignore */ }
    return [{ URL: result.url, Title: result.title }];
  },
});
