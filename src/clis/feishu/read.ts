import { execSync, spawnSync } from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const readCommand = cli({
  site: 'feishu',
  name: 'read',
  description: 'Read the current chat content by selecting all and copying',
  domain: 'localhost',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [],
  columns: ['Content'],
  func: async (page: IPage | null) => {
    if (process.platform !== 'darwin') {
      return [{ Status: 'Not supported on Linux — this command requires the macOS desktop app.' }];
    }
    try {
      let clipBackup = '';
      try {
        clipBackup = execSync('pbpaste', { encoding: 'utf-8' });
      } catch { /* empty */ }

      execSync("osascript -e 'tell application \"Lark\" to activate'");
      execSync("osascript -e 'delay 0.3'");

      execSync(
        "osascript " +
        "-e 'tell application \"System Events\"' " +
        "-e 'keystroke \"a\" using command down' " +
        "-e 'delay 0.2' " +
        "-e 'keystroke \"c\" using command down' " +
        "-e 'delay 0.2' " +
        "-e 'end tell'"
      );

      const content = execSync('pbpaste', { encoding: 'utf-8' }).trim();

      if (clipBackup) {
        spawnSync('pbcopy', { input: clipBackup });
      }

      // Deselect
      execSync("osascript -e 'tell application \"System Events\" to key code 53'");

      return [{ Content: content || '(no content captured)' }];
    } catch (err: any) {
      return [{ Content: 'Error: ' + err.message }];
    }
  },
});
