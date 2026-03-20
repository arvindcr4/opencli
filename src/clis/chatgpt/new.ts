import { execSync } from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const newCommand = cli({
  site: 'chatgpt',
  name: 'new',
  description: 'Open a new ChatGPT chat (desktop app on macOS, browser on Linux)',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: process.platform !== 'darwin',
  args: [],
  columns: ['Status'],
  func: async (page: IPage | null) => {
    try {
      if (process.platform === 'darwin') {
        execSync("osascript -e 'tell application \"ChatGPT\" to activate'");
        execSync("osascript -e 'delay 0.5'");
        execSync("osascript -e 'tell application \"System Events\" to keystroke \"n\" using command down'");
      } else {
        // Linux: open chatgpt.com in the browser via CDP
        execSync(`curl -sf -X PUT "http://localhost:9222/json/new?https://chatgpt.com" > /dev/null`);
      }
      return [{ Status: 'Success' }];
    } catch (err: any) {
      return [{ Status: "Error: " + err.message }];
    }
  },
});
