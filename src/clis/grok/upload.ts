import * as fs from 'node:fs';
import * as path from 'node:path';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const uploadCommand = cli({
  site: 'grok',
  name: 'upload',
  description: 'Upload a file to Grok for analysis',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'file', required: true, positional: true, help: 'Path to file to upload' },
    { name: 'prompt', required: false, help: 'Optional message to send with the file' },
  ],
  columns: ['File', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const filePath = path.resolve(kwargs.file as string);
    const prompt = kwargs.prompt as string | undefined;

    if (!fs.existsSync(filePath)) return [{ File: filePath, Status: 'File not found' }];

    // Click upload/attach button
    await page.evaluate(`
      (function() {
        const btns = Array.from(document.querySelectorAll('button, [role="button"], label'));
        const btn = btns.find(b => {
          const label = (b.getAttribute('aria-label') || b.title || b.textContent || '').toLowerCase();
          return label.includes('attach') || label.includes('upload') || label.includes('file');
        });
        if (btn) btn.click();
      })()
    `);
    await page.wait(1);

    // Set file on input
    const uploaded = await page.evaluate(`
      (function(fp) {
        const inp = document.querySelector('input[type="file"]');
        if (!inp) return false;
        const dt = new DataTransfer();
        dt.items.add(new File([''], fp.split('/').pop() || 'file'));
        inp.files = dt.files;
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })('${filePath.replace(/'/g, "\\'")}')
    `);

    await page.wait(2);

    if (prompt) {
      const promptJson = JSON.stringify(prompt);
      await page.evaluate(`(async () => {
        const box = document.querySelector('textarea');
        if (!box) return;
        box.focus();
        document.execCommand('insertText', false, ${promptJson});
        await new Promise(r => setTimeout(r, 500));
        const sub = [...document.querySelectorAll('button[type="submit"]')].find(b => !b.disabled);
        if (sub) sub.click();
      })()`);
    }

    return [{ File: path.basename(filePath), Status: uploaded ? 'Uploaded' : 'Upload button not found' }];
  },
});
