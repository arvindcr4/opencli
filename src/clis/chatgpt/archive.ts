import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const archiveCommand = cli({
  site: 'chatgpt',
  name: 'archive',
  description: 'Archive the current or specified ChatGPT conversation',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    { name: 'conversation_id', required: false, positional: true, help: 'Conversation ID to archive (default: current)' },
  ],
  columns: ['Conversation', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const convId = kwargs.conversation_id as string | undefined;

    if (convId) {
      await page.goto(`https://chatgpt.com/c/${convId}`);
      await page.wait(2);
    }

    // Right-click or find kebab menu for the active conversation
    const opened = await page.evaluate(`
      (function() {
        const activeLink = document.querySelector('nav a[aria-current="page"], nav a.active');
        if (!activeLink) return 'no_active';
        const parent = activeLink.closest('li') || activeLink.parentElement;
        if (!parent) return 'no_parent';
        activeLink.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        const optionsBtn = parent.querySelector('button[aria-haspopup], button[aria-label*="option"], button[aria-label*="more"]');
        if (optionsBtn) { optionsBtn.click(); return 'opened'; }
        return 'no_options';
      })()
    `);

    if (opened === 'no_active') return [{ Conversation: convId || 'current', Status: 'No active conversation in sidebar' }];

    await page.wait(1);

    const archived = await page.evaluate(`
      (function() {
        const items = Array.from(document.querySelectorAll('[role="menuitem"], button, li'));
        const archiveItem = items.find(el => /archive/i.test(el.textContent || ''));
        if (archiveItem) { archiveItem.click(); return true; }
        return false;
      })()
    `);

    if (!archived) return [{ Conversation: convId || 'current', Status: 'Archive option not found in menu' }];

    await page.wait(1);
    // Confirm if needed
    await page.evaluate(`
      (function() {
        const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => /confirm|archive/i.test(b.textContent || ''));
        if (confirmBtn) confirmBtn.click();
      })()
    `);

    return [{ Conversation: convId || 'current', Status: 'Archived' }];
  },
});
