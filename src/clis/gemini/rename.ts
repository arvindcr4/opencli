import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const renameCommand = cli({
  site: 'gemini',
  name: 'rename',
  description: 'Rename the current Gemini conversation',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [{ name: 'title', required: true, positional: true, help: 'New conversation title' }],
  columns: ['Title', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const title = kwargs.title as string;

    const opened = await page.evaluate(`
      (function() {
        const active = document.querySelector('.conversation-item.active, [aria-current="page"], .gmat-body-1.active');
        if (!active) return 'no_active';
        const parent = active.closest('li') || active.parentElement;
        if (!parent) return 'no_parent';
        active.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        const moreBtn = parent.querySelector('button[aria-label*="More"], button[aria-label*="option"], mat-icon-button');
        if (moreBtn) { moreBtn.click(); return 'opened'; }
        const contextMenu = parent.querySelector('[mat-icon-button], button');
        if (contextMenu) { contextMenu.click(); return 'fallback_opened'; }
        return 'no_menu';
      })()
    `);

    if (opened === 'no_active') return [{ Title: title, Status: 'No active conversation found' }];

    await page.wait(1);

    const clicked = await page.evaluate(`
      (function() {
        const items = Array.from(document.querySelectorAll('[role="menuitem"], .mat-menu-item, button'));
        const item = items.find(el => /rename|edit/i.test(el.textContent || ''));
        if (item) { item.click(); return true; }
        return false;
      })()
    `);

    if (!clicked) return [{ Title: title, Status: 'Rename option not found' }];

    await page.wait(1);
    await page.evaluate(`
      (function() {
        const inp = document.querySelector('input:focus, .rename-input input, [aria-label*="rename"] input');
        if (inp) inp.select();
      })()
    `);
    await page.evaluate(`document.execCommand('selectAll')`);
    await page.typeText('', title);
    await page.pressKey('Return');

    return [{ Title: title, Status: 'Renamed' }];
  },
});
