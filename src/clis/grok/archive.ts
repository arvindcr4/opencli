import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const archiveCommand = cli({
  site: 'grok',
  name: 'archive',
  description: 'Archive the current grok conversation',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Status'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');

    const opened = await page.evaluate(`
      (function() {
        const active = document.querySelector('nav a[aria-current="page"], nav a.active, nav [class*="active"]');
        if (!active) return 'no_active';
        const parent = active.closest('li') || active.parentElement;
        if (!parent) return 'no_parent';
        active.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
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
        const item = items.find(el => /archive/i.test(el.textContent || ''));
        if (item) { item.click(); return true; }
        return false;
      })()
    `);

    if (!clicked) return [{ Status: 'Archive option not found in menu' }];

    await page.wait(1);
    await page.evaluate(`
      (function() {
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b =>
          /confirm|archive|yes/i.test(b.textContent || '')
        );
        if (confirmBtn) confirmBtn.click();
      })()
    `);

    return [{ Status: 'Archived' }];
  },
});
