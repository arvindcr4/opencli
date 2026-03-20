import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const switchCommand = cli({
  site: 'claude',
  name: 'switch',
  description: 'Switch Claude.ai model (opus, sonnet, haiku)',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    {
      name: 'model',
      required: true,
      positional: true,
      help: 'Model to switch to: opus | sonnet | haiku | opus-4 | sonnet-4',
      choices: ['opus', 'sonnet', 'haiku', 'opus-4', 'sonnet-4', 'claude-4'],
    },
  ],
  columns: ['Model', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const model = (kwargs.model as string).toLowerCase();

    // Open model picker
    const opened = await page.evaluate(`
      (function() {
        const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
        const modelBtn = btns.find(b => {
          const t = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
          return t.includes('model') || t.includes('claude') || t.includes('opus') || t.includes('sonnet');
        });
        if (modelBtn) { modelBtn.click(); return true; }
        return false;
      })()
    `);

    if (!opened) return [{ Model: model, Status: 'Model picker not found' }];
    await page.wait(1);

    const selected = await page.evaluate(`
      (function(targetModel) {
        const items = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"], button, li'));
        const item = items.find(el => (el.textContent || '').toLowerCase().includes(targetModel));
        if (item) { item.click(); return true; }
        return false;
      })(${JSON.stringify(model)})
    `);

    await page.wait(1);
    if (!selected) return [{ Model: model, Status: 'Model option not found' }];
    return [{ Model: model, Status: 'Switched' }];
  },
});
