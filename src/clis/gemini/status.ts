import { execSync } from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const statusCommand = cli({
  site: 'gemini',
  name: 'status',
  description: 'Check Gemini service reachability and current page state',
  domain: 'gemini.google.com',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [],
  columns: ['Status'],
  func: async (page: IPage | null) => {
    try {
      execSync('curl -sf --max-time 5 https://gemini.google.com > /dev/null');
      return [{ Status: 'gemini.google.com reachable' }];
    } catch {
      return [{ Status: 'gemini.google.com unreachable' }];
    }
  },
});
