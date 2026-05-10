import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { COPILOT365_URL } from './_lib/shared.js';

export const newCommand = cli({
  site: 'copilot365',
  name: 'new',
  description: 'Start a new chat in Microsoft 365 Copilot',
  domain: 'm365.cloud.microsoft',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Status'],
  func: async (page: IPage) => {
    await page.goto(COPILOT365_URL);
    await page.wait(4);

    await page.evaluate(`
      () => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const target = buttons.find(b => {
          const label = (
            b.getAttribute('aria-label')
            || b.getAttribute('data-tid')
            || b.getAttribute('data-testid')
            || b.textContent
            || ''
          ).toLowerCase();
          return label.includes('new chat')
            || label.includes('new-chat')
            || label.includes('start new')
            || label.includes('compose');
        });
        if (target) target.click();
      }
    `);

    return [{ Status: 'New chat started (or already on a fresh chat surface)' }];
  },
});
