import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const switchCommand = cli({
  site: 'gemini',
  name: 'switch',
  description: 'Switch Gemini model (flash, pro, advanced, ultra, exp)',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    {
      name: 'model',
      required: true,
      positional: true,
      help: 'Model to switch to: flash | pro | advanced | ultra | exp | 2.0 | 1.5',
      choices: ['flash', 'pro', 'advanced', 'ultra', 'exp', '2.0', '1.5'],
    },
  ],
  columns: ['Model', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const model = (kwargs.model as string).toLowerCase();

    // Open model switcher
    const opened = await page.evaluate(`
      (function() {
        const btns = Array.from(document.querySelectorAll('button, [role="button"], mat-select'));
        const modelBtn = btns.find(b => {
          const t = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
          return t.includes('gemini') || t.includes('model') || t.includes('flash') || t.includes('pro');
        });
        if (modelBtn) { modelBtn.click(); return true; }
        return false;
      })()
    `);

    if (!opened) return [{ Model: model, Status: 'Model switcher not found' }];
    await page.wait(1);

    // Select the model from dropdown
    const selected = await page.evaluate(`
      (function(targetModel) {
        const items = Array.from(document.querySelectorAll(
          '[role="option"], [role="menuitem"], mat-option, li, button'
        ));
        const item = items.find(el => {
          const t = (el.textContent || el.getAttribute('aria-label') || '').toLowerCase();
          return t.includes(targetModel);
        });
        if (item) { item.click(); return true; }
        return false;
      })(${JSON.stringify(model)})
    `);

    await page.wait(1);
    if (!selected) return [{ Model: model, Status: 'Model option not found in dropdown' }];
    return [{ Model: model, Status: 'Switched' }];
  },
});
