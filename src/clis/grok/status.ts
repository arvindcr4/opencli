import { execSync } from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const statusCommand = cli({
  site: 'grok',
  name: 'status',
  description: 'Check Grok service reachability and current page state',
  domain: 'grok.com',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [],
  columns: ['Status'],
  func: async (page: IPage | null) => {
    try {
      execSync('curl -sf --max-time 5 https://grok.com > /dev/null');
      return [{ Status: 'grok.com reachable' }];
    } catch {
      return [{ Status: 'grok.com unreachable' }];
    }
  },
});
