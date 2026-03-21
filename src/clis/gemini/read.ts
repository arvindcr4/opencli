import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const readCommand = cli({
  site: 'gemini',
  name: 'read',
  description: 'Read the latest Gemini conversation messages',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'last', type: 'int', default: 0, help: 'Only show last N messages (0 = all)' },
  ],
  columns: ['Role', 'Text'],
  func: async (page: IPage, kwargs: Record<string, any>) => {
    const last = (kwargs.last as number) || 0;

    const messages = await page.evaluate(`
      () => {
        const results = [];

        // Gemini uses custom elements: user-query and model-response
        const turns = document.querySelectorAll('user-query, model-response');

        turns.forEach(turn => {
          const isUser = turn.tagName.toLowerCase() === 'user-query';
          let text = (turn.innerText || turn.textContent || '').trim();
          if (text) {
            // Clean up accessibility prefixes
            if (!isUser) {
              text = text.replace(/^(Show thinking|Hide thinking)\\s*/i, '').trim();
              text = text.replace(/^Gemini said\\s*/i, '').trim();
            }
            results.push({
              Role: isUser ? 'User' : 'Gemini',
              Text: text.substring(0, 2000)
            });
          }
        });

        return results;
      }
    `);

    if (!messages || messages.length === 0) {
      return [{ Role: 'System', Text: 'No conversation found on the current page.' }];
    }

    if (last > 0) {
      return messages.slice(-last);
    }
    return messages;
  },
});
