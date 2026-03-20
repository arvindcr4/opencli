import * as childProcess from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const copyCommand = cli({
  site: 'grok',
  name: 'copy',
  description: 'Copy the last grok response to clipboard',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'index', required: false, help: 'Response index (default: last = -1)', default: '-1' },
  ],
  columns: ['Chars', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const index = parseInt(kwargs.index as string, 10);

    // Try the built-in copy button first
    const builtInCopied = await page.evaluate(`
      (function(idx) {
        const copyBtns = Array.from(document.querySelectorAll('button[aria-label*="Copy" i], button[aria-label*="copy" i], button[data-testid*="copy"]'));
        const targetBtn = idx === -1 ? copyBtns[copyBtns.length - 1] : copyBtns[idx];
        if (targetBtn) { targetBtn.click(); return true; }
        return false;
      })()
    `);

    if (builtInCopied) return [{ Chars: 'N/A', Status: 'Copied via built-in button' }];

    // Fallback: extract text and copy via clipboard API
    const text = await page.evaluate(`
      (function(idx) {
        const responses = Array.from(document.querySelectorAll(
          '[data-message-author-role="assistant"], model-response, .message-bubble, [class*="assistant"]'
        ));
        const target = idx === -1 ? responses[responses.length - 1] : responses[idx];
        return target ? (target.innerText || target.textContent || '').trim() : '';
      })()
    `) as string;

    if (!text) return [{ Chars: '0', Status: 'No response found' }];

    // Copy to clipboard via xclip/xsel on Linux or pbcopy on macOS
    try {
      if (process.platform === 'darwin') {
        childProcess.execSync('pbcopy', { input: text });
      } else {
        try {
          childProcess.execSync('xclip -selection clipboard', { input: text });
        } catch {
          childProcess.execSync('xsel --clipboard --input', { input: text });
        }
      }
      return [{ Chars: String(text.length), Status: 'Copied to clipboard' }];
    } catch {
      return [{ Chars: String(text.length), Status: 'Could not copy (no clipboard tool)' }];
    }
  },
});
