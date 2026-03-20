import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { getVisibleChatMessagesFromPage } from './ax.js';

async function isGenerating(page: IPage): Promise<boolean> {
  const result = await page.evaluate(`
    (function() {
      if (document.querySelector('[data-testid="stop-button"]')) return true;
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => /^stop/i.test((b.textContent || b.getAttribute('aria-label') || '').trim()));
    })()
  `);
  return !!result;
}

export const searchCommand = cli({
  site: 'chatgpt',
  name: 'search',
  description: 'Ask ChatGPT a question using web search mode',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  timeoutSeconds: 300,
  args: [
    { name: 'query', required: true, positional: true, help: 'Search query to send' },
    { name: 'timeout', required: false, help: 'Max seconds to wait (default: 120)', default: '120' },
  ],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const query = kwargs.query as string;
    const timeout = parseInt(kwargs.timeout as string, 10) || 120;

    // Navigate to search-enabled URL or toggle search mode
    await page.goto('https://chatgpt.com/?q=&hints=search');
    await page.wait(2);

    const snapshot = await page.snapshot({ interactive: true });
    const nodes = (snapshot?.nodes as any[]) ?? [];
    const inputRef =
      nodes.find((n: any) => n.role === 'textbox' && n.id?.includes('prompt'))?.ref ??
      nodes.find((n: any) =>
        (n.role === 'textbox' || n.role === 'combobox') &&
        (n.name?.toLowerCase().includes('message') || n.placeholder?.toLowerCase().includes('message'))
      )?.ref;

    if (!inputRef) throw new Error('Could not find ChatGPT input');

    const messagesBefore = await getVisibleChatMessagesFromPage(page);
    await page.click(inputRef);
    await page.typeText(inputRef, query);
    await page.pressKey('Return');

    const deadline = Date.now() + timeout * 1000;
    let response = '';
    let prev = '';
    let stableCount = 0;

    while (Date.now() < deadline) {
      await page.wait(3);
      const generating = await isGenerating(page);
      if (generating) { stableCount = 0; continue; }

      const messages = await getVisibleChatMessagesFromPage(page);
      const newMessages = messages.slice(messagesBefore.length);
      const latest = newMessages[newMessages.length - 1] ?? '';

      if (latest.length > 20) {
        if (latest === prev) {
          stableCount++;
          if (stableCount >= 2) { response = latest; break; }
        } else {
          stableCount = 0;
          prev = latest;
        }
      }
    }

    if (!response) {
      return [{ Role: 'System', Text: `No response within ${timeout}s` }];
    }
    return [{ Role: 'User', Text: query }, { Role: 'Assistant', Text: response }];
  },
});
