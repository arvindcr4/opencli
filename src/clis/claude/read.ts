import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { getLastClaudeResponse } from './ax.js';

export const readCommand = cli({
  site: 'claude',
  name: 'read',
  description: 'Read the most recent Claude.ai response',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');
    const text = await getLastClaudeResponse(page);
    if (!text) return [{ Role: 'System', Text: 'No response found' }];
    return [{ Role: 'Assistant', Text: text }];
  },
});
