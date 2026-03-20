import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const regenerateCommand = cli({
  site: 'claude',
  name: 'regenerate',
  description: 'Regenerate / retry the last claude.ai response',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Status'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');

    const clicked = await page.evaluate(`
      (function() {
        // Look for regenerate/retry/reload button
        const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
        const regenBtn = btns.find(b => {
          const label = (b.getAttribute('aria-label') || b.title || b.textContent || '').toLowerCase();
          return label.includes('regenerate') || label.includes('retry') || label.includes('reload') ||
                 label.includes('try again') || label.includes('redo');
        });
        if (regenBtn && !regenBtn.disabled) { regenBtn.click(); return true; }
        return false;
      })()
    `);

    if (!clicked) return [{ Status: 'Regenerate button not found' }];
    return [{ Status: 'Regenerating' }];
  },
});
