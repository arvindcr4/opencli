import { execSync } from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const statusCommand = cli({
  site: 'claude',
  name: 'status',
  description: 'Check Claude.ai service reachability and current page state',
  domain: 'claude.ai',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [],
  columns: ['Status'],
  func: async (page: IPage | null) => {
    try {
      execSync('curl -sf --max-time 5 https://claude.ai > /dev/null');
      return [{ Status: 'claude.ai reachable' }];
    } catch {
      return [{ Status: 'claude.ai unreachable' }];
    }
  },
});
