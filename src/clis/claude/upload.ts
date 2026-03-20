import * as path from 'node:path';
import * as fs from 'node:fs';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { CDPBridge } from '../../browser/cdp.js';

export const uploadCommand = cli({
  site: 'claude',
  name: 'upload',
  description: 'Upload a local file to Claude.ai and optionally send with a message',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'file', required: true, positional: true, help: 'Path to the local file to upload' },
    { name: 'message', required: false, help: 'Optional message to send with the file', default: '' },
  ],
  columns: ['File', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const filePath = path.resolve(kwargs.file as string);
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    const message = (kwargs.message as string) || '';

    // Click attach button
    const clicked = await page.evaluate(`
      (function() {
        const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
        const attachBtn = btns.find(b => {
          const label = (b.getAttribute('aria-label') || b.getAttribute('title') || '').toLowerCase();
          return label.includes('attach') || label.includes('upload') || label.includes('file');
        });
        if (attachBtn) { attachBtn.click(); return true; }
        return false;
      })()
    `);

    if (!clicked) return [{ File: path.basename(filePath), Status: 'Attach button not found' }];
    await page.wait(1);

    const cdpBridge = new CDPBridge();
    const _p = await cdpBridge.connect();
    try {
      const nodeResult = await cdpBridge.send('DOM.getDocument', { depth: -1, pierce: true });
      const docNodeId = nodeResult?.root?.nodeId;
      if (!docNodeId) throw new Error('Could not get DOM root');

      const queryResult = await cdpBridge.send('DOM.querySelector', {
        nodeId: docNodeId,
        selector: 'input[type="file"]',
      });

      if (!queryResult?.nodeId || queryResult.nodeId === 0) {
        return [{ File: path.basename(filePath), Status: 'File input not found after clicking attach' }];
      }

      await cdpBridge.send('DOM.setFileInputFiles', {
        nodeId: queryResult.nodeId,
        files: [filePath],
      });

      await page.wait(2);

      if (message) {
        const snapshot = await page.snapshot({ interactive: true });
        const nodes = (snapshot?.nodes as any[]) ?? [];
        const inputRef = nodes.find((n: any) => n.role === 'textbox')?.ref;
        if (inputRef) await page.typeText(inputRef, message);
      }

      await page.pressKey('Return');
      return [{ File: path.basename(filePath), Status: 'Uploaded and sent' }];
    } finally {
      await cdpBridge.close();
    }
  },
});
