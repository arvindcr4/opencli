import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const memoryCommand = cli({
  site: 'gemini',
  name: 'memory',
  description: 'View or clear Gemini memory (saved context)',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'action', required: false, positional: true, help: 'Action: view | clear (default: view)', choices: ['view', 'clear'], default: 'view' },
  ],
  columns: ['Key', 'Value'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const action = (kwargs.action as string) || 'view';

    await page.goto('https://gemini.google.com/settings');
    await page.wait(3);

    if (action === 'clear') {
      const cleared = await page.evaluate(`
        (function() {
          const btns = Array.from(document.querySelectorAll('button'));
          const clearBtn = btns.find(b => /clear|delete|reset/i.test(b.textContent || b.getAttribute('aria-label') || ''));
          if (clearBtn) { clearBtn.click(); return true; }
          return false;
        })()
      `);
      if (!cleared) return [{ Key: 'Status', Value: 'Clear button not found' }];
      await page.wait(2);
      await page.evaluate(`
        (function() {
          const confirm = Array.from(document.querySelectorAll('button')).find(b =>
            /confirm|yes|clear/i.test(b.textContent || '')
          );
          if (confirm) confirm.click();
        })()
      `);
      return [{ Key: 'Status', Value: 'Memory cleared' }];
    }

    const entries = await page.evaluate(`
      (function() {
        const items = Array.from(document.querySelectorAll('[class*="memory"], [class*="Memory"], .saved-info, .memory-item'));
        if (items.length) {
          return JSON.stringify(items.map((el, i) => ({ key: String(i + 1), value: (el.textContent || '').trim().slice(0, 200) })));
        }
        const main = document.querySelector('main, [role="main"]');
        return JSON.stringify([{ key: 'Page', value: (main?.textContent || '').trim().slice(0, 500) || 'No memory settings found' }]);
      })()
    `);

    let result: Array<{ key: string; value: string }> = [];
    try { result = JSON.parse(entries as string); } catch { /* ignore */ }
    return result.map(r => ({ Key: r.key, Value: r.value }));
  },
});
