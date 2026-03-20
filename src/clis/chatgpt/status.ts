import { execSync } from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const statusCommand = cli({
  site: 'chatgpt',
  name: 'status',
  description: 'Check ChatGPT status (desktop app on macOS, chatgpt.com reachability on Linux)',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [],
  columns: ['Status'],
  func: async (page: IPage | null) => {
    if (process.platform === 'darwin') {
      try {
        const output = execSync("osascript -e 'application \"ChatGPT\" is running'", { encoding: 'utf-8' }).trim();
        return [{ Status: output === 'true' ? 'Running' : 'Stopped' }];
      } catch {
        return [{ Status: 'Error querying application state' }];
      }
    }
    // Linux: check chatgpt.com reachability
    try {
      execSync('curl -sf --max-time 5 https://chatgpt.com > /dev/null');
      return [{ Status: 'chatgpt.com reachable' }];
    } catch {
      return [{ Status: 'chatgpt.com unreachable' }];
    }
  },
});
