import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const customInstructionsCommand = cli({
  site: 'chatgpt',
  name: 'custom_instructions',
  description: 'View or update ChatGPT custom instructions',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    { name: 'action', required: false, positional: true, help: 'Action: view | set (default: view)', choices: ['view', 'set'], default: 'view' },
    { name: 'about', required: false, help: 'What to tell ChatGPT about you (for set action)' },
    { name: 'respond', required: false, help: 'How ChatGPT should respond (for set action)' },
  ],
  columns: ['Field', 'Content'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const action = (kwargs.action as string) || 'view';

    // Open custom instructions dialog
    await page.evaluate(`
      (function() {
        // Try profile menu
        const profileBtn = document.querySelector('[data-testid*="profile"], button[aria-label*="profile" i], button[aria-label*="account" i]');
        if (profileBtn) profileBtn.click();
      })()
    `);
    await page.wait(1);
    
    const opened = await page.evaluate(`
      (function() {
        const items = Array.from(document.querySelectorAll('[role="menuitem"], button, li, a'));
        const ciItem = items.find(el => /custom.instruction/i.test(el.textContent || ''));
        if (ciItem) { ciItem.click(); return true; }
        return false;
      })()
    `);

    if (!opened) {
      // Navigate directly to settings
      await page.goto('https://chatgpt.com/#settings');
      await page.wait(2);
    }

    await page.wait(2);

    if (action === 'view') {
      const content = await page.evaluate(`
        (function() {
          const textareas = Array.from(document.querySelectorAll('textarea'));
          return JSON.stringify(textareas.map((ta, i) => ({
            field: i === 0 ? 'About you' : 'How to respond',
            content: ta.value || ta.textContent || ''
          })));
        })()
      `);

      let fields: Array<{ field: string; content: string }> = [];
      try { fields = JSON.parse(content as string); } catch { /* ignore */ }
      if (!fields.length) return [{ Field: 'Status', Content: 'Custom instructions dialog not found' }];
      return fields.map(f => ({ Field: f.field, Content: f.content.slice(0, 200) || '(empty)' }));
    }

    // Set action
    const about = kwargs.about as string | undefined;
    const respond = kwargs.respond as string | undefined;

    if (!about && !respond) return [{ Field: 'Status', Content: 'Provide --about or --respond to set instructions' }];

    await page.evaluate(`
      (function(aboutText, respondText) {
        const textareas = Array.from(document.querySelectorAll('textarea'));
        if (aboutText && textareas[0]) {
          textareas[0].focus();
          textareas[0].select();
          document.execCommand('selectAll');
          document.execCommand('insertText', false, aboutText);
        }
        if (respondText && textareas[1]) {
          textareas[1].focus();
          textareas[1].select();
          document.execCommand('selectAll');
          document.execCommand('insertText', false, respondText);
        }
      })(${JSON.stringify(about || '')}, ${JSON.stringify(respond || '')})
    `);

    // Save
    await page.evaluate(`
      (function() {
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b =>
          /save|confirm|done/i.test(b.textContent || '')
        );
        if (saveBtn) saveBtn.click();
      })()
    `);

    return [{ Field: 'Status', Content: 'Instructions updated' }];
  },
});
