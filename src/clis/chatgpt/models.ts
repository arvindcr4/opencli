import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const modelsCommand = cli({
  site: 'chatgpt',
  name: 'models',
  description: 'List available ChatGPT models in the model switcher',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [],
  columns: ['Model', 'Available'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');

    await page.goto('https://chatgpt.com/');
    await page.wait(3);

    // Click model selector to see options
    const opened = await page.evaluate(`
      (function() {
        const selectors = ['button[aria-haspopup="listbox"]', 'button[aria-haspopup="menu"]', '[class*="model-selector"] button'];
        for (const sel of selectors) {
          const btn = document.querySelector(sel);
          if (btn) { btn.click(); return true; }
        }
        // Try by text
        const btns = Array.from(document.querySelectorAll('button'));
        const modelBtn = btns.find(b => /gpt|o3|o1|claude|gemini/i.test(b.textContent || ''));
        if (modelBtn) { modelBtn.click(); return true; }
        return false;
      })()
    `);

    if (!opened) return [{ Model: 'Model selector not found', Available: 'N/A' }];

    await page.wait(1);

    const models = await page.evaluate(`
      (function() {
        const options = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], [role="listitem"]'));
        const modelList = options
          .map(el => {
            const text = (el.textContent || '').trim();
            const disabled = el.getAttribute('aria-disabled') === 'true' || el.classList.contains('disabled');
            return { name: text.slice(0, 60), available: disabled ? 'No' : 'Yes' };
          })
          .filter(m => m.name.length > 0);
        return JSON.stringify(modelList);
      })()
    `);

    // Close the dropdown
    await page.pressKey('Escape');

    let modelList: Array<{ name: string; available: string }> = [];
    try { modelList = JSON.parse(models as string); } catch { /* ignore */ }
    if (!modelList.length) return [{ Model: 'No models found in dropdown', Available: 'N/A' }];
    return modelList.map(m => ({ Model: m.name, Available: m.available }));
  },
});
