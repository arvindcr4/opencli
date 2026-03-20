import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const customInstructionsCommand = cli({
  site: 'claude',
  name: 'custom_instructions',
  description: 'View or update Claude system prompt / custom instructions',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'action', required: false, positional: true, help: 'Action: view | set (default: view)', choices: ['view', 'set'], default: 'view' },
    { name: 'instructions', required: false, help: 'Instructions to set (for set action)' },
  ],
  columns: ['Field', 'Content'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const action = (kwargs.action as string) || 'view';

    await page.goto('https://claude.ai/settings');
    await page.wait(3);

    // Navigate to custom instructions section
    const navClicked = await page.evaluate(`
      (function() {
        const links = Array.from(document.querySelectorAll('a, button, [role="tab"]'));
        const link = links.find(el => /custom|instruction|prompt|behavior/i.test(el.textContent || el.getAttribute('aria-label') || ''));
        if (link) { link.click(); return true; }
        return false;
      })()
    `);
    if (navClicked) await page.wait(2);

    if (action === 'view') {
      const content = await page.evaluate(`
        (function() {
          const textareas = Array.from(document.querySelectorAll('textarea'));
          if (textareas.length) return JSON.stringify(textareas.map((ta, i) => ({ field: 'Instruction ' + (i+1), content: ta.value || '' })));
          const editable = document.querySelector('[contenteditable="true"]');
          if (editable) return JSON.stringify([{ field: 'Instructions', content: (editable.textContent || '').trim() }]);
          return JSON.stringify([{ field: 'Status', content: 'No custom instructions found' }]);
        })()
      `);
      let fields: Array<{ field: string; content: string }> = [];
      try { fields = JSON.parse(content as string); } catch { /* ignore */ }
      return fields.map(f => ({ Field: f.field, Content: f.content.slice(0, 200) || '(empty)' }));
    }

    const instructions = kwargs.instructions as string | undefined;
    if (!instructions) return [{ Field: 'Status', Content: 'Provide --instructions to set' }];

    await page.evaluate(`
      (function(text) {
        const ta = document.querySelector('textarea');
        if (ta) {
          ta.focus(); ta.select();
          document.execCommand('selectAll');
          document.execCommand('insertText', false, text);
        }
      })(${JSON.stringify(instructions)})
    `);

    await page.evaluate(`
      (function() {
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => /save|confirm|update/i.test(b.textContent || ''));
        if (saveBtn) saveBtn.click();
      })()
    `);

    return [{ Field: 'Status', Content: 'Instructions updated' }];
  },
});
