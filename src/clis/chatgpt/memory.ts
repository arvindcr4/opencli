import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const memoryCommand = cli({
  site: 'chatgpt',
  name: 'memory',
  description: 'Read ChatGPT\'s memory entries, or clear/delete specific ones',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    {
      name: 'action',
      required: false,
      positional: true,
      help: 'Action: list (default) | clear',
      choices: ['list', 'clear'],
      default: 'list',
    },
  ],
  columns: ['#', 'Memory'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const action = (kwargs.action as string) || 'list';

    // Navigate to memory settings
    await page.goto('https://chatgpt.com/?model=gpt-4o#memory');
    await page.wait(2);

    // Try to open settings → memory
    await page.evaluate(`
      (function() {
        // Try clicking Settings or Profile menu
        const btns = Array.from(document.querySelectorAll('button, [role="button"], a'));
        const settingsBtn = btns.find(b => {
          const t = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
          return t.includes('setting') || t.includes('profile');
        });
        if (settingsBtn) settingsBtn.click();
      })()
    `);
    await page.wait(1);

    // Click Personalization or Memory tab
    await page.evaluate(`
      (function() {
        const items = Array.from(document.querySelectorAll('button, [role="button"], a, li'));
        const memBtn = items.find(el => {
          const t = (el.textContent || el.getAttribute('aria-label') || '').toLowerCase();
          return t === 'memory' || t === 'personalization' || t.includes('memories');
        });
        if (memBtn) memBtn.click();
      })()
    `);
    await page.wait(1);

    if (action === 'clear') {
      // Click "Clear memory" button
      const cleared = await page.evaluate(`
        (function() {
          const btns = Array.from(document.querySelectorAll('button'));
          const clearBtn = btns.find(b => /clear/i.test(b.textContent || ''));
          if (clearBtn) { clearBtn.click(); return true; }
          return false;
        })()
      `);
      await page.wait(1);
      // Confirm if dialog appears
      await page.evaluate(`
        (function() {
          const btns = Array.from(document.querySelectorAll('button'));
          const confirmBtn = btns.find(b => /confirm|yes|clear|ok/i.test(b.textContent || ''));
          if (confirmBtn) confirmBtn.click();
        })()
      `);
      return [{ '#': '-', Memory: cleared ? 'Memory cleared' : 'Clear button not found' }];
    }

    // Extract memory entries
    const raw = await page.evaluate(`
      (function() {
        const entries = Array.from(document.querySelectorAll('[class*="memory"] li, [class*="Memory"] li, ul li'));
        if (!entries.length) {
          // Try generic list items in the current modal/panel
          const items = Array.from(document.querySelectorAll('li, [role="listitem"]'));
          return JSON.stringify(items.slice(0, 50).map(el => (el.textContent || '').trim()).filter(Boolean));
        }
        return JSON.stringify(entries.map((el, i) => (el.textContent || '').trim()));
      })()
    `);

    let memories: string[] = [];
    try { memories = JSON.parse(raw); } catch { /* ignore */ }
    memories = memories.filter(m => m.length > 0 && m.length < 500);

    if (!memories.length) {
      return [{ '#': '-', Memory: 'No memory entries found (or memory is off in Settings)' }];
    }
    return memories.map((m, i) => ({ '#': i + 1, Memory: m }));
  },
});
