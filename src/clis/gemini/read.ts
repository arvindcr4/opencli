import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { getLastGeminiResponse } from './ax.js';

export const readCommand = cli({
  site: 'gemini',
  name: 'read',
  description: 'Read the most recent Gemini response',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');
    const text = await getLastGeminiResponse(page);
    if (!text) return [{ Role: 'System', Text: 'No response found' }];
    return [{ Role: 'Assistant', Text: text }];
  },
});
