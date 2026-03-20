import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const notesCommand = cli({
  site: 'grok',
  name: 'notes',
  description: 'View conversation summary or save notes from Grok',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'action', required: false, positional: true, help: 'Action: view | save (default: view)', choices: ['view', 'save'], default: 'view' },
  ],
  columns: ['Action', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const action = (kwargs.action as string) || 'view';

    if (action === 'save') {
      const saved = await page.evaluate(`
        (function() {
          const btns = Array.from(document.querySelectorAll('button, [role="menuitem"]'));
          const saveBtn = btns.find(b => {
            const label = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
            return label.includes('save') || label.includes('export') || label.includes('bookmark');
          });
          if (saveBtn) { saveBtn.click(); return true; }
          return false;
        })()
      `);
      return [{ Action: 'save', Status: saved ? 'Save dialog opened' : 'Save button not found' }];
    }

    const info = await page.evaluate(`
      (function() {
        const title = document.title.replace(' - Grok', '').trim();
        const bubbles = document.querySelectorAll('[data-testid="message-bubble"], div.message-bubble');
        const last = bubbles[bubbles.length - 1];
        const preview = last ? (last.innerText || '').trim().slice(0, 200) : '';
        return JSON.stringify({ title, count: bubbles.length, preview });
      })()
    `);

    let result = { title: '', count: 0, preview: '' };
    try { result = JSON.parse(info as string); } catch { /* ignore */ }
    return [{ Action: `"${result.title}" (${result.count} messages)`, Status: result.preview.slice(0, 100) || 'No content' }];
  },
});
