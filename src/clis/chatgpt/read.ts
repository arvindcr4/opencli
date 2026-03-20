import { execSync } from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { getVisibleChatMessages, getVisibleChatMessagesFromPage } from './ax.js';

export const readCommand = cli({
  site: 'chatgpt',
  name: 'read',
  description: 'Read the most recent ChatGPT response (desktop app on macOS, browser on Linux)',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: process.platform !== 'darwin',
  args: [],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null) => {
    try {
      let messages: string[];
      if (process.platform === 'darwin') {
        execSync("osascript -e 'tell application \"ChatGPT\" to activate'");
        execSync("osascript -e 'delay 0.3'");
        messages = getVisibleChatMessages();
      } else {
        if (!page) throw new Error('Browser page not available');
        messages = await getVisibleChatMessagesFromPage(page);
      }

      if (!messages.length) {
        return [{ Role: 'System', Text: 'No visible chat messages found.' }];
      }
      return [{ Role: 'Assistant', Text: messages[messages.length - 1] }];
    } catch (err: any) {
      throw new Error("Failed to read from ChatGPT: " + err.message);
    }
  },
});
