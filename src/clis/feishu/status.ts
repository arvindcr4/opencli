import { execSync } from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const statusCommand = cli({
  site: 'feishu',
  name: 'status',
  description: 'Check if Feishu (Lark) Desktop is running on macOS',
  domain: 'localhost',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [],
  columns: ['Status', 'Detail'],
  func: async (page: IPage | null) => {
    if (process.platform !== 'darwin') {
      return [{ Status: 'Not supported on Linux — this command requires the macOS desktop app.' }];
    }
    try {
      const running = execSync("osascript -e 'application \"Lark\" is running'", { encoding: 'utf-8' }).trim();
      if (running !== 'true') {
        return [{ Status: 'Stopped', Detail: 'Feishu/Lark is not running' }];
      }

      const windowCount = execSync(
        "osascript -e 'tell application \"System Events\" to count windows of application process \"Lark\"'",
        { encoding: 'utf-8' }
      ).trim();

      return [{
        Status: 'Running',
        Detail: `${windowCount} window(s) open`,
      }];
    } catch (err: any) {
      return [{ Status: 'Error', Detail: err.message }];
    }
  },
});
