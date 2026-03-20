import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const renameCommand = cli({
  site: 'grok',
  name: 'rename',
  description: 'Rename the current Grok conversation',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [{ name: 'title', required: true, positional: true, help: 'New conversation title' }],
  columns: ['Title', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const title = kwargs.title as string;

    const opened = await page.evaluate(`
      (function() {
        const active = document.querySelector('nav a[aria-current="page"], nav .active, [data-testid*="conversation"][class*="active"]');
        if (!active) return 'no_active';
        const parent = active.closest('li') || active.parentElement;
        if (!parent) return 'no_parent';
        active.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        const moreBtn = parent.querySelector('button[aria-label*="More"], button[aria-label*="options"], button[aria-label*="menu"], button[aria-haspopup]');
        if (moreBtn) { moreBtn.click(); return 'opened'; }
        return 'no_menu';
      })()
    `);

    if (opened === 'no_active') return [{ Title: title, Status: 'No active conversation found' }];

    await page.wait(1);

    const clicked = await page.evaluate(`
      (function() {
        const items = Array.from(document.querySelectorAll('[role="menuitem"], button, li'));
        const item = items.find(el => /rename|edit/i.test(el.textContent || ''));
        if (item) { item.click(); return true; }
        return false;
      })()
    `);

    if (!clicked) return [{ Title: title, Status: 'Rename option not found' }];

    await page.wait(1);
    await page.evaluate(`
      (function() {
        const inp = document.querySelector('input:focus, input[type="text"]');
        if (inp) inp.select();
      })()
    `);
    await page.evaluate(`document.execCommand('selectAll')`);
    await page.typeText('', title);
    await page.pressKey('Return');

    return [{ Title: title, Status: 'Renamed' }];
  },
});
