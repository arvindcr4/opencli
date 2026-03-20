import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const switchCommand = cli({
  site: 'grok',
  name: 'switch',
  description: 'Switch the Grok model (grok-3, grok-3-mini, grok-2, etc.)',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'model', required: true, positional: true, help: 'Model to switch to: grok-3 | grok-3-mini | grok-2 | mini', choices: ['grok-3', 'grok-3-mini', 'grok-2', 'mini', '3', '2'] },
  ],
  columns: ['Model', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const modelArg = (kwargs.model as string).toLowerCase();

    const modelAliases: Record<string, string> = {
      '3': 'grok-3',
      '2': 'grok-2',
      'mini': 'grok-3-mini',
    };
    const targetModel = modelAliases[modelArg] || modelArg;

    // Click model selector
    const opened = await page.evaluate(`
      (function() {
        const selectors = [
          'button[aria-label*="model" i]',
          'button[data-testid*="model" i]',
          '[class*="model-selector"] button',
          'button[aria-haspopup="listbox"]',
        ];
        for (const sel of selectors) {
          const btn = document.querySelector(sel);
          if (btn) { btn.click(); return true; }
        }
        // Try buttons with model text
        const btns = Array.from(document.querySelectorAll('button'));
        const modelBtn = btns.find(b => /grok/i.test(b.textContent || ''));
        if (modelBtn) { modelBtn.click(); return true; }
        return false;
      })()
    `);

    if (!opened) return [{ Model: targetModel, Status: 'Model selector not found' }];

    await page.wait(1);

    const switched = await page.evaluate(`
      (function(target) {
        const options = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], li, button'));
        const option = options.find(el => {
          const text = (el.textContent || '').toLowerCase();
          return text.includes(target.toLowerCase());
        });
        if (option) { option.click(); return true; }
        return false;
      })(${JSON.stringify(targetModel)})
    `);

    if (!switched) return [{ Model: targetModel, Status: 'Model option not found in dropdown' }];

    await page.wait(1);
    return [{ Model: targetModel, Status: 'Switched' }];
  },
});
