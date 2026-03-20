import { execSync } from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const newCommand = cli({
  site: 'feishu',
  name: 'new',
  description: 'Create a new message or document in Feishu',
  domain: 'localhost',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [],
  columns: ['Status'],
  func: async (page: IPage | null) => {
    if (process.platform !== 'darwin') {
      return [{ Status: 'Not supported on Linux — this command requires the macOS desktop app.' }];
    }
    try {
      execSync("osascript -e 'tell application \"Lark\" to activate'");
      execSync("osascript -e 'delay 0.3'");

      // Cmd+N for new conversation/document
      execSync(
        "osascript " +
        "-e 'tell application \"System Events\"' " +
        "-e 'keystroke \"n\" using command down' " +
        "-e 'end tell'"
      );

      return [{ Status: 'New item dialog opened (Cmd+N)' }];
    } catch (err: any) {
      return [{ Status: 'Error: ' + err.message }];
    }
  },
});
