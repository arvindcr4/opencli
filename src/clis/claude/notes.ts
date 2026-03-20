import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const notesCommand = cli({
  site: 'claude',
  name: 'notes',
  description: 'View or add notes to the current Claude project',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'action', required: false, positional: true, help: 'Action: view | add (default: view)', choices: ['view', 'add'], default: 'view' },
    { name: 'content', required: false, help: 'Note content to add (for add action)' },
  ],
  columns: ['Note', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const action = (kwargs.action as string) || 'view';
    const content = kwargs.content as string | undefined;

    // Navigate to project notes if in a project context
    const notesSection = await page.evaluate(`
      (function() {
        // Look for notes section in sidebar or project view
        const notesLink = Array.from(document.querySelectorAll('a, button, [role="tab"]')).find(el =>
          /notes?/i.test(el.textContent || el.getAttribute('aria-label') || '')
        );
        if (notesLink) { notesLink.click(); return true; }
        return false;
      })()
    `);

    if (notesSection) await page.wait(2);

    if (action === 'view') {
      const notes = await page.evaluate(`
        (function() {
          const notesEl = document.querySelector('[class*="notes"], [data-testid*="notes"], .project-notes');
          if (notesEl) return (notesEl.innerText || notesEl.textContent || '').trim().slice(0, 2000);
          // Fallback: look for any editor/textarea with notes content
          const editors = Array.from(document.querySelectorAll('[contenteditable="true"], textarea'));
          for (const ed of editors) {
            const text = (ed.textContent || ed.value || '').trim();
            if (text.length > 10) return text.slice(0, 2000);
          }
          return 'No notes found';
        })()
      `);
      return [{ Note: notes as string, Status: 'OK' }];
    }

    // Add note
    if (!content) return [{ Note: '', Status: 'Provide --content to add a note' }];

    const addBtn = await page.evaluate(`
      (function() {
        const addBtns = Array.from(document.querySelectorAll('button')).find(b =>
          /add.note|new.note|create.note|\+/i.test(b.textContent || b.getAttribute('aria-label') || '')
        );
        if (addBtns) { addBtns.click(); return true; }
        return false;
      })()
    `);

    await page.wait(1);

    const editor = await page.evaluate(`document.querySelector('[contenteditable="true"], textarea')`);
    if (!editor) return [{ Note: content, Status: 'No notes editor found' }];

    await page.evaluate(`
      (function(text) {
        const ed = document.querySelector('[contenteditable="true"]') || document.querySelector('textarea');
        if (ed) {
          ed.focus();
          document.execCommand('selectAll');
          document.execCommand('insertText', false, text);
        }
      })(${JSON.stringify(content)})
    `);

    await page.evaluate(`
      (function() {
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b =>
          /save|done|confirm/i.test(b.textContent || '')
        );
        if (saveBtn) saveBtn.click();
      })()
    `);

    return [{ Note: content.slice(0, 80), Status: 'Note added' }];
  },
});
