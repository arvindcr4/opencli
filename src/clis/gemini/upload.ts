import * as fs from 'node:fs';
import * as path from 'node:path';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const uploadCommand = cli({
  site: 'gemini',
  name: 'upload',
  description: 'Upload a file to the current Gemini conversation',
  domain: 'gemini.google.com',
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

    // Look for file upload button
    const uploadClicked = await page.evaluate(`
      (function() {
        const btns = Array.from(document.querySelectorAll('button, [role="button"], label'));
        const uploadBtn = btns.find(b => {
          const label = (b.getAttribute('aria-label') || b.title || b.textContent || '').toLowerCase();
          return label.includes('upload') || label.includes('attach') || label.includes('file') || label.includes('image');
        });
        if (uploadBtn) { uploadBtn.click(); return true; }
        // Look for file input
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) return 'file_input_exists';
        return false;
      })()
    `);

    await page.wait(1);

    // Upload the file via input
    const uploaded = await page.evaluate(`
      (function(fp) {
        const inp = document.querySelector('input[type="file"]');
        if (!inp) return false;
        const dataTransfer = new DataTransfer();
        const file = new File([''], fp.split('/').pop() || 'file');
        dataTransfer.items.add(file);
        inp.files = dataTransfer.files;
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })('${filePath.replace(/'/g, "\\'")}')
    `);

    if (!uploaded && uploadClicked === false) {
      return [{ File: filePath, Status: 'Upload button not found' }];
    }

    await page.wait(2);

    if (prompt) {
      const snapshot = await page.snapshot({ interactive: true });
      const nodes = (snapshot?.nodes as any[]) ?? [];
      const inputRef = nodes.find((n: any) => n.role === 'textbox' || n.role === 'combobox')?.ref;
      if (inputRef) {
        await page.click(inputRef);
        await page.typeText(inputRef, prompt);
        await page.pressKey('Return');
      }
    }

    return [{ File: path.basename(filePath), Status: 'Uploaded' }];
  },
});
