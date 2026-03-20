import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const memoryCommand = cli({
  site: 'grok',
  name: 'memory',
  description: 'View or clear Grok memory (personalization data)',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'action', required: false, positional: true, help: 'Action: view | clear (default: view)', choices: ['view', 'clear'], default: 'view' },
  ],
  columns: ['Key', 'Value'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const action = (kwargs.action as string) || 'view';

    await page.goto('https://grok.com/settings');
    await page.wait(3);

    if (action === 'clear') {
      const cleared = await page.evaluate(`
        (function() {
          const btns = Array.from(document.querySelectorAll('button'));
          const clearBtn = btns.find(b => /clear|delete|reset.memory/i.test(b.textContent || b.getAttribute('aria-label') || ''));
          if (clearBtn) { clearBtn.click(); return true; }
          return false;
        })()
      `);
      if (!cleared) return [{ Key: 'Status', Value: 'Clear memory button not found' }];
      await page.wait(1);
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

    const content = await page.evaluate(`
      (function() {
        const memSection = Array.from(document.querySelectorAll('[class*="memory"], [class*="Memory"], section, [id*="memory"]'))
          .find(el => /memory/i.test(el.textContent || ''));
        if (memSection) return (memSection.textContent || '').trim().slice(0, 1000);
        const main = document.querySelector('main, [role="main"]');
        return (main?.textContent || '').trim().slice(0, 500) || 'No memory settings found';
      })()
    `);

    return [{ Key: 'Memory Settings', Value: (content as string) || 'No memory settings found' }];
  },
});
