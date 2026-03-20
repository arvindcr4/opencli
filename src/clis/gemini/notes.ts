import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const notesCommand = cli({
  site: 'gemini',
  name: 'notes',
  description: 'View or save the current Gemini conversation to Google Keep / Docs',
  domain: 'gemini.google.com',
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
      // Try to find "Save to Docs" or "Export" functionality
      const saved = await page.evaluate(`
        (function() {
          const btns = Array.from(document.querySelectorAll('button, [role="menuitem"], a'));
          const saveBtn = btns.find(b => {
            const label = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
            return label.includes('save') || label.includes('docs') || label.includes('keep') || label.includes('export');
          });
          if (saveBtn) { saveBtn.click(); return true; }
          return false;
        })()
      `);
      return [{ Action: 'save', Status: saved ? 'Save dialog opened' : 'Save to Docs button not found' }];
    }

    // View: show current conversation title and summary
    const info = await page.evaluate(`
      (function() {
        const title = document.title.replace(' - Gemini', '').trim();
        const turnCount = document.querySelectorAll('model-response, user-query').length;
        const lastResp = Array.from(document.querySelectorAll('model-response')).pop();
        const preview = lastResp ? (lastResp.innerText || '').trim().slice(0, 200) : '';
        return JSON.stringify({ title, turns: turnCount, preview });
      })()
    `);

    let result = { title: '', turns: 0, preview: '' };
    try { result = JSON.parse(info as string); } catch { /* ignore */ }
    return [{ Action: `"${result.title}" (${result.turns} turns)`, Status: result.preview.slice(0, 100) || 'No content' }];
  },
});
