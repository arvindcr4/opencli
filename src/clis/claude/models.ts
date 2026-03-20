import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const modelsCommand = cli({
  site: 'claude',
  name: 'models',
  description: 'List available claude models in the model switcher',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Model', 'Available'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');

    await page.goto('https://claude.ai');
    await page.wait(3);

    const opened = await page.evaluate(`
      (function() {
        const selectors = ['button[aria-haspopup="listbox"]', 'button[aria-haspopup="menu"]', '[class*="model-selector"] button'];
        for (const sel of selectors) {
          const btn = document.querySelector(sel);
          if (btn) { btn.click(); return true; }
        }
        const btns = Array.from(document.querySelectorAll('button'));
        const modelBtn = btns.find(b => /model|gpt|claude|gemini|grok/i.test(b.textContent || ''));
        if (modelBtn) { modelBtn.click(); return true; }
        return false;
      })()
    `);

    if (!opened) return [{ Model: 'Model selector not found', Available: 'N/A' }];
    await page.wait(1);

    const models = await page.evaluate(`
      (function() {
        const options = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], [role="listitem"]'));
        return JSON.stringify(options
          .map(el => {
            const text = (el.textContent || '').trim().slice(0, 60);
            const disabled = el.getAttribute('aria-disabled') === 'true';
            return { name: text, available: disabled ? 'No' : 'Yes' };
          })
          .filter(m => m.name.length > 0)
        );
      })()
    `);

    await page.pressKey('Escape');
    let modelList: Array<{ name: string; available: string }> = [];
    try { modelList = JSON.parse(models as string); } catch { /* ignore */ }
    if (!modelList.length) return [{ Model: 'No models found', Available: 'N/A' }];
    return modelList.map(m => ({ Model: m.name, Available: m.available }));
  },
});
