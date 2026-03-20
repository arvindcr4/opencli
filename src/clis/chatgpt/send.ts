import { execSync } from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { clipRead, clipWrite } from '../../utils/clipboard.js';

export const sendCommand = cli({
  site: 'chatgpt',
  name: 'send',
  description: 'Send a message to ChatGPT (desktop app on macOS, browser on Linux)',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: process.platform !== 'darwin',
  args: [{ name: 'text', required: true, positional: true, help: 'Message to send' }],
  columns: ['Status'],
  func: async (page: IPage | null, kwargs: any) => {
    const text = kwargs.text as string;
    try {
      if (process.platform === 'darwin') {
        let clipBackup = '';
        try { clipBackup = clipRead(); } catch {}
        clipWrite(text);
        execSync("osascript -e 'tell application \"ChatGPT\" to activate'");
        execSync("osascript -e 'delay 0.5'");
        execSync("osascript " +
          "-e 'tell application \"System Events\"' " +
          "-e 'keystroke \"v\" using command down' " +
          "-e 'delay 0.2' " +
          "-e 'keystroke return' " +
          "-e 'end tell'");
        if (clipBackup) clipWrite(clipBackup);
      } else {
        // Linux: interact with chatgpt.com in browser
        if (!page) throw new Error('Browser page not available');
        const snapshot = await page.snapshot({ interactive: true });
        const inputRef = snapshot?.nodes?.find((n: any) =>
          (n.role === 'textbox' || n.role === 'combobox') &&
          (n.name?.toLowerCase().includes('message') || n.placeholder?.toLowerCase().includes('message'))
        )?.ref;
        if (!inputRef) throw new Error('Could not find ChatGPT input field — make sure chatgpt.com is open');
        await page.click(inputRef);
        await page.typeText(inputRef, text);
        await page.pressKey('Return');
      }
      return [{ Status: 'Success' }];
    } catch (err: any) {
      return [{ Status: "Error: " + err.message }];
    }
  },
});
