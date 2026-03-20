import * as fs from 'node:fs';
import * as path from 'node:path';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { getLastClaudeResponse, isClaudeGenerating } from './ax.js';

export const imageCommand = cli({
  site: 'claude',
  name: 'image',
  description: 'Upload an image to Claude for analysis or visual Q&A',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  timeoutSeconds: 300,
  args: [
    { name: 'file', required: true, positional: true, help: 'Path to image file to analyze' },
    { name: 'prompt', required: false, help: 'Question or instruction about the image (default: "Describe this image")', default: 'Describe this image' },
    { name: 'timeout', required: false, help: 'Max seconds to wait (default: 120)', default: '120' },
  ],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const filePath = path.resolve(kwargs.file as string);
    const prompt = (kwargs.prompt as string) || 'Describe this image';
    const timeout = parseInt(kwargs.timeout as string, 10) || 120;

    if (!fs.existsSync(filePath)) return [{ Role: 'System', Text: `File not found: ${filePath}` }];

    // Click upload button
    await page.evaluate(`
      (function() {
        const btns = Array.from(document.querySelectorAll('button, label'));
        const uploadBtn = btns.find(b => {
          const label = (b.getAttribute('aria-label') || b.title || b.textContent || '').toLowerCase();
          return label.includes('attach') || label.includes('upload') || label.includes('file') || label.includes('image');
        });
        if (uploadBtn) uploadBtn.click();
      })()
    `);
    await page.wait(1);

    // Set the file
    const uploaded = await page.evaluate(`
      (function(fp) {
        const inp = document.querySelector('input[type="file"]');
        if (!inp) return false;
        const dt = new DataTransfer();
        dt.items.add(new File([''], fp.split('/').pop() || 'image.jpg', { type: 'image/jpeg' }));
        inp.files = dt.files;
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      })('${filePath.replace(/'/g, "\\'")}')
    `);

    await page.wait(2);

    // Type and send prompt
    const snapshot = await page.snapshot({ interactive: true });
    const nodes = (snapshot?.nodes as any[]) ?? [];
    const inputRef = nodes.find((n: any) => n.role === 'textbox')?.ref;
    if (inputRef) {
      await page.click(inputRef);
      await page.typeText(inputRef, prompt);
    }

    const sent = await page.evaluate(`
      (function() {
        const btn = document.querySelector('button[aria-label*="Send"], button[data-testid*="send"], button[type="submit"]');
        if (btn && !btn.disabled) { btn.click(); return true; }
        return false;
      })()
    `);
    if (!sent) await page.pressKey('Return');

    const deadline = Date.now() + timeout * 1000;
    let prev = '';
    let stableCount = 0;

    while (Date.now() < deadline) {
      await page.wait(3);
      if (await isClaudeGenerating(page)) { stableCount = 0; continue; }
      const cur = await getLastClaudeResponse(page);
      if (cur && cur.length > 20) {
        if (cur === prev) {
          stableCount++;
          if (stableCount >= 2) return [{ Role: 'User', Text: `[Image: ${path.basename(filePath)}] ${prompt}` }, { Role: 'Assistant', Text: cur }];
        } else { stableCount = 0; prev = cur; }
      }
    }

    return [{ Role: 'System', Text: `Timeout after ${timeout}s — response: ${prev.slice(0, 100)}` }];
  },
});
