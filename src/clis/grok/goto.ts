import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const gotoCommand = cli({
  site: 'grok',
  name: 'goto',
  description: 'Navigate to a Grok conversation or page by URL or conversation ID',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'target', required: true, positional: true, help: 'Full URL or conversation ID' },
    { name: 'wait', required: false, help: 'Seconds to wait after navigation (default: 2)', default: '2' },
  ],
  columns: ['URL', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const target = kwargs.target as string;
    const waitSecs = parseInt(kwargs.wait as string, 10) || 2;

    let url: string;
    if (target.startsWith('http')) {
      url = target;
    } else if (target.startsWith('/')) {
      url = `https://grok.com${target}`;
    } else {
      url = `https://grok.com/chat/${target}`;
    }

    await page.goto(url);
    if (waitSecs > 0) await page.wait(waitSecs);
    return [{ URL: url, Status: 'Navigated' }];
  },
});
