import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const renameCommand = cli({
  site: 'chatgpt',
  name: 'rename',
  description: 'Rename the current ChatGPT conversation',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    { name: 'title', required: true, positional: true, help: 'New conversation title' },
  ],
  columns: ['Title', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const title = kwargs.title as string;

    // Right-click or find the rename option for the active conversation
    const result = await page.evaluate(`
      (function() {
        // Find active conversation link in sidebar
        const activeLink = document.querySelector('nav a[aria-current="page"], nav a.active');
        if (!activeLink) return 'no_active';

        // Look for more options / kebab menu button near the active item
        const parent = activeLink.closest('li') || activeLink.parentElement;
        if (!parent) return 'no_parent';

        // Hover to reveal options
        activeLink.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        const optionsBtn = parent.querySelector('button[aria-haspopup], button[aria-label*="option"], button[aria-label*="more"]');
        if (optionsBtn) { optionsBtn.click(); return 'menu_opened'; }
        return 'no_options';
      })()
    `);

    if (result === 'no_active') {
      return [{ Title: title, Status: 'No active conversation found in sidebar' }];
    }

    await page.wait(1);

    // Click Rename in dropdown
    const renamed = await page.evaluate(`
      (function() {
        const items = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"], button, li'));
        const renameItem = items.find(el => /rename/i.test(el.textContent || ''));
        if (renameItem) { renameItem.click(); return true; }
        return false;
      })()
    `);

    if (!renamed) {
      return [{ Title: title, Status: 'Rename option not found in menu' }];
    }

    await page.wait(1);

    // Clear existing text and type new title
    await page.evaluate(`
      (function() {
        const input = document.querySelector('input[type="text"]:focus, input[value]');
        if (input) {
          input.select();
          document.execCommand('selectAll');
        }
      })()
    `);

    // Type new title and confirm
    await page.evaluate(`document.execCommand('selectAll')`);
    await page.typeText('', title);
    await page.pressKey('Return');

    return [{ Title: title, Status: 'Renamed' }];
  },
});
