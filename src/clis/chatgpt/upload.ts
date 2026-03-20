import * as path from 'node:path';
import * as fs from 'node:fs';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { CDPBridge } from '../../browser/cdp.js';

export const uploadCommand = cli({
  site: 'chatgpt',
  name: 'upload',
  description: 'Upload a local file to the current ChatGPT conversation',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
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

    // Click the paperclip / attach button to reveal file input
    const attachClicked = await page.evaluate(`
      (function() {
        const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
        const attachBtn = btns.find(b => {
          const label = (b.getAttribute('aria-label') || b.getAttribute('title') || '').toLowerCase();
          return label.includes('attach') || label.includes('upload') || label.includes('file') || label.includes('clip');
        });
        if (attachBtn) { attachBtn.click(); return true; }
        return false;
      })()
    `);

    if (!attachClicked) {
      return [{ File: path.basename(filePath), Status: 'Attach button not found — update ChatGPT UI selectors' }];
    }

    await page.wait(1);

    // Use CDP to set file on the file input
    const cdpBridge = new CDPBridge();
    const _p = await cdpBridge.connect();
    try {
      // Find file input node via DOM
      const nodeResult = await cdpBridge.send('DOM.getDocument', { depth: -1, pierce: true });
      const docNodeId = nodeResult?.root?.nodeId;
      if (!docNodeId) throw new Error('Could not get DOM root');

      // Query for file input
      const queryResult = await cdpBridge.send('DOM.querySelector', {
        nodeId: docNodeId,
        selector: 'input[type="file"]',
      });

      if (!queryResult?.nodeId || queryResult.nodeId === 0) {
        return [{ File: path.basename(filePath), Status: 'File input not found after clicking attach — try again' }];
      }

      await cdpBridge.send('DOM.setFileInputFiles', {
        nodeId: queryResult.nodeId,
        files: [filePath],
      });

      // Optionally type a message
      if (message) {
        await page.wait(1);
        await page.typeText('', message);
      }

      // Submit
      await page.wait(1);
      await page.pressKey('Return');

      return [{ File: path.basename(filePath), Status: 'Uploaded and sent' }];
    } finally {
      await cdpBridge.close();
    }
  },
});
