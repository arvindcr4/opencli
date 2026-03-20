import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const readCommand = cli({
  site: 'grok',
  name: 'read',
  description: 'Read the most recent Grok response',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');
    const result = await page.evaluate(`
      (function() {
        const bubbles = Array.from(document.querySelectorAll('div.message-bubble, [data-testid="message-bubble"]'));
        if (!bubbles.length) return '';
        return (bubbles[bubbles.length - 1].innerText || '').trim();
      })()
    `);
    const text = (result as string) || '';
    if (!text) return [{ Role: 'System', Text: 'No response found' }];
    return [{ Role: 'Assistant', Text: text }];
  },
});
