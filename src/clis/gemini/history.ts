import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { getAllGeminiMessages } from './ax.js';

export const historyCommand = cli({
  site: 'gemini',
  name: 'history',
  description: 'Read all messages in the current Gemini conversation',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'role', required: false, help: 'Filter by role: user | assistant | all (default: all)', default: 'all' },
    { name: 'limit', required: false, help: 'Max messages to show (default: all)', default: '0' },
  ],
  columns: ['#', 'Role', 'Text'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const roleFilter = (kwargs.role as string) || 'all';
    const limit = parseInt(kwargs.limit as string, 10) || 0;

    let messages = await getAllGeminiMessages(page);
    if (!messages.length) return [{ '#': '-', Role: 'System', Text: 'No messages found' }];

    if (roleFilter !== 'all') messages = messages.filter(m => m.role === roleFilter);
    if (limit > 0) messages = messages.slice(-limit);

    return messages.map((m, i) => ({
      '#': i + 1,
      Role: m.role,
      Text: m.text.slice(0, 3000) + (m.text.length > 3000 ? '…' : ''),
    }));
  },
});
