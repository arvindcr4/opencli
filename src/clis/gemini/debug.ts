import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const debugCommand = cli({
  site: 'gemini',
  name: 'debug',
  description: 'Debug Gemini page structure (find input selectors)',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'scope', type: 'string', default: 'all', help: 'What to inspect: all, buttons, input, deep-research' },
  ],
  columns: ['Type', 'Selector', 'Details'],
  timeoutSeconds: 60,
  func: async (page: IPage, kwargs: Record<string, any>) => {
    const scope = (kwargs.scope as string) || 'all';

    const info = await page.evaluate(`
      () => {
        const results = [];
        const scope = ${JSON.stringify(scope)};

        if (scope === 'all' || scope === 'deep-research') {
          // Search for ANYTHING mentioning "deep research" or "research"
          const allEls = document.querySelectorAll('*');
          for (const el of allEls) {
            const text = (el.textContent || '').trim().toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            const cls = (el.className || '').toString().toLowerCase();
            const tag = el.tagName.toLowerCase();

            if ((text.includes('deep research') || aria.includes('deep research') || cls.includes('deep-research') || cls.includes('deep_research')) &&
                (tag === 'button' || tag === 'a' || tag === 'mat-icon' || tag === 'span' || tag === 'div' || tag === 'mat-option' || el.getAttribute('role'))) {
              // Avoid duplicating parent element text
              const directText = Array.from(el.childNodes)
                .filter(n => n.nodeType === 3)
                .map(n => n.textContent.trim())
                .join(' ') || text.substring(0, 60);

              results.push({
                Type: 'deep-research',
                Selector: tag + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(' ').slice(0,2).join('.') : ''),
                Details: 'aria=' + aria.substring(0, 40) + ' text=' + directText.substring(0, 60) + ' role=' + (el.getAttribute('role') || 'none') + ' tag=' + tag
              });
            }
          }

          // Also look for the input area buttons/chips near the prompt
          const inputArea = document.querySelector('.input-area-container, .input-buttons, .text-input-field, [class*="input-area"]');
          if (inputArea) {
            const btns = inputArea.querySelectorAll('button, a, [role="button"], [role="tab"]');
            btns.forEach(btn => {
              const t = (btn.textContent || '').trim().substring(0, 60);
              const a = btn.getAttribute('aria-label') || '';
              results.push({
                Type: 'input-area-btn',
                Selector: btn.tagName.toLowerCase() + '.' + (String(btn.className).split(' ').slice(0,2).join('.') || 'none'),
                Details: 'aria=' + a.substring(0, 40) + ' text=' + t
              });
            });
          }
        }

        if (scope === 'all' || scope === 'buttons') {
          const editables = document.querySelectorAll('[contenteditable="true"]');
          editables.forEach(el => {
            results.push({
              Type: 'contenteditable',
              Selector: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').join('.') : ''),
              Details: 'aria=' + (el.getAttribute('aria-label') || 'none')
            });
          });

          const buttons = document.querySelectorAll('button');
          buttons.forEach(btn => {
            const aria = btn.getAttribute('aria-label') || '';
            const text = (btn.textContent || '').trim().substring(0, 30);
            if (aria.toLowerCase().includes('send') || aria.toLowerCase().includes('submit') ||
                aria.toLowerCase().includes('research') || aria.toLowerCase().includes('mode') ||
                aria.toLowerCase().includes('deep') ||
                text.toLowerCase().includes('send') || text.toLowerCase().includes('research') ||
                text.toLowerCase().includes('deep')) {
              results.push({
                Type: 'button',
                Selector: 'button.' + (String(btn.className).split(' ').slice(0,3).join('.') || 'none'),
                Details: 'aria=' + aria.substring(0, 40) + ' text=' + text + ' disabled=' + btn.disabled
              });
            }
          });
        }

        return results;
      }
    `);

    return info && info.length > 0 ? info : [{ Type: 'none', Selector: '-', Details: 'No matching elements found' }];
  },
});
