import { execSync, spawnSync } from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const sendCommand = cli({
  site: 'wechat',
  name: 'send',
  description: 'Send a message in the active WeChat conversation via clipboard paste',
  domain: 'localhost',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [{ name: 'text', required: true, positional: true, help: 'Message to send' }],
  columns: ['Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (process.platform !== 'darwin') {
      return [{ Status: 'Not supported on Linux — this command requires the macOS desktop app.' }];
    }
    const text = kwargs.text as string;
    try {
      // Backup clipboard
      let clipBackup = '';
      try {
        clipBackup = execSync('pbpaste', { encoding: 'utf-8' });
      } catch { /* clipboard may be empty */ }

      // Copy text to clipboard
      spawnSync('pbcopy', { input: text });

      // Activate WeChat and paste
      execSync("osascript -e 'tell application \"WeChat\" to activate'");
      execSync("osascript -e 'delay 0.5'");

      execSync(
        "osascript " +
        "-e 'tell application \"System Events\"' " +
        "-e 'keystroke \"v\" using command down' " +
        "-e 'delay 0.2' " +
        "-e 'keystroke return' " +
        "-e 'end tell'"
      );

      // Restore clipboard
      if (clipBackup) {
        spawnSync('pbcopy', { input: clipBackup });
      }

      return [{ Status: 'Success' }];
    } catch (err: any) {
      return [{ Status: 'Error: ' + err.message }];
    }
  },
});
