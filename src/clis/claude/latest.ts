import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const latestCommand = cli({
  site: 'claude',
  name: 'latest',
  description: 'Navigate to the most recent claude conversation',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'wait', required: false, help: 'Seconds to wait after navigation (default: 2)', default: '2' },
  ],
  columns: ['URL', 'Title'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const waitSecs = parseInt(kwargs.wait as string, 10) || 2;

    const first = await page.evaluate(`
      (function() {
        const links = Array.from(document.querySelectorAll('a[href*='/chat/']'));
        if (!links.length) return null;
        return { href: links[0].href, title: (links[0].textContent || '').trim().slice(0, 60) };
      })()
    `) as { href: string; title: string } | null;

    if (!first) return [{ URL: 'No conversations found', Title: '' }];

    await page.goto(first.href);
    if (waitSecs > 0) await page.wait(waitSecs);

    return [{ URL: first.href, Title: first.title }];
  },
});
