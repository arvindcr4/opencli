import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const notesCommand = cli({
  site: 'chatgpt',
  name: 'notes',
  description: 'View conversation summary or access ChatGPT project notes',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
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

    // Try to navigate to project notes
    const notesOpened = await page.evaluate(`
      (function() {
        const links = Array.from(document.querySelectorAll('a, button, [role="tab"]'));
        const notesLink = links.find(el =>
          /notes?|instructions?/i.test(el.textContent || el.getAttribute('aria-label') || '')
        );
        if (notesLink) { notesLink.click(); return true; }
        return false;
      })()
    `);
    if (notesOpened) await page.wait(2);

    if (action === 'view') {
      const info = await page.evaluate(`
        (function() {
          const notesArea = document.querySelector('[class*="notes"], [class*="instruction"], [data-testid*="notes"]');
          if (notesArea) return (notesArea.textContent || '').trim().slice(0, 2000);
          const title = document.title.replace(' - ChatGPT', '').trim();
          const turns = document.querySelectorAll('[data-message-author-role]').length;
          return 'Title: ' + title + '\\nMessages: ' + turns;
        })()
      `);
      return [{ Note: info as string, Status: 'OK' }];
    }

    if (!content) return [{ Note: '', Status: 'Provide --content to add a note' }];

    const added = await page.evaluate(`
      (function(text) {
        const ta = document.querySelector('[contenteditable="true"], textarea.notes-input, [class*="notes"] textarea');
        if (ta) {
          ta.focus();
          document.execCommand('selectAll');
          document.execCommand('insertText', false, text);
          return true;
        }
        return false;
      })(${JSON.stringify(content)})
    `);

    return [{ Note: content.slice(0, 80), Status: added ? 'Note added' : 'Notes editor not found' }];
  },
});
