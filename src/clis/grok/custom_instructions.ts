import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const customInstructionsCommand = cli({
  site: 'grok',
  name: 'custom_instructions',
  description: 'View or update Grok custom instructions / system prompt',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'action', required: false, positional: true, help: 'Action: view | set (default: view)', choices: ['view', 'set'], default: 'view' },
    { name: 'instructions', required: false, help: 'Custom instructions to set (for set action)' },
  ],
  columns: ['Field', 'Content'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const action = (kwargs.action as string) || 'view';

    await page.goto('https://grok.com/settings');
    await page.wait(3);

    if (action === 'view') {
      const content = await page.evaluate(`
        (function() {
          const textareas = Array.from(document.querySelectorAll('textarea'));
          const customSection = textareas.find(ta =>
            /custom|instruction|system/i.test(ta.getAttribute('placeholder') || ta.getAttribute('aria-label') || '')
          ) || textareas[0];
          if (customSection) return customSection.value || customSection.textContent || '';
          const main = document.querySelector('[class*="custom-instruction"], [class*="system-prompt"]');
          return main ? (main.textContent || '').trim() : 'No custom instructions found';
        })()
      `);
      return [{ Field: 'Custom Instructions', Content: (content as string) || 'None' }];
    }

    const instructions = kwargs.instructions as string | undefined;
    if (!instructions) return [{ Field: 'Status', Content: 'Provide --instructions to set' }];

    await page.evaluate(`
      (function(text) {
        const textareas = Array.from(document.querySelectorAll('textarea'));
        const target = textareas.find(ta =>
          /custom|instruction|system/i.test(ta.getAttribute('placeholder') || '')
        ) || textareas[0];
        if (target) {
          target.focus();
          target.select();
          document.execCommand('selectAll');
          document.execCommand('insertText', false, text);
        }
      })(${JSON.stringify(instructions)})
    `);

    await page.evaluate(`
      (function() {
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b =>
          /save|confirm|update/i.test(b.textContent || '')
        );
        if (saveBtn) saveBtn.click();
      })()
    `);

    return [{ Field: 'Status', Content: 'Instructions updated' }];
  },
});
