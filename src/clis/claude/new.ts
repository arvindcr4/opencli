import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const newCommand = cli({
  site: 'claude',
  name: 'new',
  description: 'Start a new Claude.ai conversation',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'project', required: false, help: 'Project name or ID to open new chat in' },
  ],
  columns: ['Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    await page.goto('https://claude.ai/new');
    await page.wait(2);
    return [{ Status: 'New conversation started' }];
  },
});
