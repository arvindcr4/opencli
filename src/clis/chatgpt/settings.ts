import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const settingsCommand = cli({
  site: 'chatgpt',
  name: 'settings',
  description: 'Open chatgpt settings page',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    { name: 'section', required: false, positional: true, help: 'Settings section to navigate to (optional)' },
  ],
  columns: ['URL', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const section = kwargs.section as string | undefined;

    const baseUrl = 'https://chatgpt.com/#settings';
    const url = section ? baseUrl + '/' + section : baseUrl;

    await page.goto(url);
    await page.wait(2);

    const title = await page.evaluate(`document.title`) as string;
    return [{ URL: url, Status: title || 'Settings opened' }];
  },
});
