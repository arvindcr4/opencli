import { execSync, spawnSync } from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const readCommand = cli({
  site: 'wechat',
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
      // Backup clipboard
      let clipBackup = '';
      try {
        clipBackup = execSync('pbpaste', { encoding: 'utf-8' });
      } catch { /* empty */ }

      // Activate WeChat
      execSync("osascript -e 'tell application \"WeChat\" to activate'");
      execSync("osascript -e 'delay 0.3'");

      // Click on the chat area first, then select all and copy
      execSync(
        "osascript " +
        "-e 'tell application \"System Events\"' " +
        "-e 'tell application process \"WeChat\"' " +
        // Click in the message area (center-right of the window)
        "-e 'set frontWin to front window' " +
        "-e 'set winPos to position of frontWin' " +
        "-e 'set winSize to size of frontWin' " +
        "-e 'end tell' " +
        "-e 'end tell'"
      );

      execSync("osascript -e 'delay 0.2'");

      // Select all text in chat area and copy
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

      // Restore clipboard
      if (clipBackup) {
        spawnSync('pbcopy', { input: clipBackup });
      }

      // Press Escape to deselect
      execSync(
        "osascript " +
        "-e 'tell application \"System Events\"' " +
        "-e 'key code 53' " + // Escape
        "-e 'end tell'"
      );

      return [{ Content: content || '(no content captured)' }];
    } catch (err: any) {
      return [{ Content: 'Error: ' + err.message }];
    }
  },
});
