import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const deleteCommand = cli({
  site: 'gemini',
  name: 'delete',
  description: 'Delete the current gemini conversation',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'force', required: false, help: 'Skip confirmation prompt', type: 'boolean', default: false },
  ],
  columns: ['Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');

    const opened = await page.evaluate(`
      (function() {
        const activeLink = document.querySelector('nav a[aria-current="page"], nav a.active, nav [class*="active"]');
        if (!activeLink) return 'no_active';
        const parent = activeLink.closest('li') || activeLink.parentElement;
        if (!parent) return 'no_parent';
        activeLink.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        const btn = parent.querySelector('button[aria-haspopup], button[aria-label*="more" i], button[aria-label*="option" i]');
        if (btn) { btn.click(); return 'opened'; }
        return 'no_menu';
      })()
    `);

    if (opened === 'no_active') return [{ Status: 'No active conversation found' }];

    await page.wait(1);

    const clicked = await page.evaluate(`
      (function() {
        const items = Array.from(document.querySelectorAll('[role="menuitem"], button, li'));
        const item = items.find(el => /delete|remove/i.test(el.textContent || ''));
        if (item) { item.click(); return true; }
        return false;
      })()
    `);

    if (!clicked) return [{ Status: 'Delete option not found in menu' }];

    await page.wait(1);

    // Confirm deletion
    await page.evaluate(`
      (function() {
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b =>
          /confirm|delete|yes/i.test(b.textContent || '')
        );
        if (confirmBtn) confirmBtn.click();
      })()
    `);

    return [{ Status: 'Deleted' }];
  },
});
