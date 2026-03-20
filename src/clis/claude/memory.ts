import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const memoryCommand = cli({
  site: 'claude',
  name: 'memory',
  description: 'View or manage Claude memory settings',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'action', required: false, positional: true, help: 'Action: view | clear (default: view)', choices: ['view', 'clear'], default: 'view' },
  ],
  columns: ['Key', 'Value'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const action = (kwargs.action as string) || 'view';

    await page.goto('https://claude.ai/settings/memory');
    await page.wait(3);

    if (action === 'clear') {
      const cleared = await page.evaluate(`
        (function() {
          const clearBtn = Array.from(document.querySelectorAll('button')).find(b =>
            /clear|delete|remove/i.test(b.textContent || b.getAttribute('aria-label') || '')
          );
          if (clearBtn) { clearBtn.click(); return true; }
          return false;
        })()
      `);
      if (!cleared) return [{ Key: 'Status', Value: 'Clear button not found' }];
      await page.wait(2);
      // Confirm if dialog appears
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

    // View: extract memory entries
    const entries = await page.evaluate(`
      (function() {
        const items = Array.from(document.querySelectorAll('[class*="memory-item"], [class*="Memory"] li, .memory-entry'));
        if (items.length) {
          return JSON.stringify(items.map((el, i) => ({ key: String(i + 1), value: (el.textContent || '').trim().slice(0, 200) })));
        }
        // Fallback: get page text sections
        const main = document.querySelector('main, [role="main"]');
        const text = main ? (main.textContent || '').trim().slice(0, 1000) : '';
        return JSON.stringify([{ key: 'Memory', value: text || 'No memory entries found' }]);
      })()
    `);

    let result: Array<{ key: string; value: string }> = [];
    try { result = JSON.parse(entries as string); } catch { /* ignore */ }
    if (!result.length) return [{ Key: 'Status', Value: 'No memory entries found' }];
    return result.map(r => ({ Key: r.key, Value: r.value }));
  },
});
