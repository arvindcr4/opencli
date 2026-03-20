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

export const codeInterpreterCommand = cli({
  site: 'chatgpt',
  name: 'code_interpreter',
  description: 'Run a code snippet using ChatGPT Code Interpreter and get the output',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  timeoutSeconds: 600,
  args: [
    { name: 'prompt', required: true, positional: true, help: 'Code or data analysis task to run' },
    { name: 'timeout', required: false, help: 'Max seconds to wait (default: 300)', default: '300' },
  ],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const prompt = kwargs.prompt as string;
    const timeout = parseInt(kwargs.timeout as string, 10) || 300;

    await page.goto('https://chatgpt.com/');
    await page.wait(3);

    const responseBefore = (await getVisibleChatMessagesFromPage(page)).pop() ?? '';

    const snapshot = await page.snapshot({ interactive: true });
    const nodes = (snapshot?.nodes as any[]) ?? [];
    const inputRef = nodes.find((n: any) => n.role === 'textbox' || n.role === 'combobox')?.ref;
    if (!inputRef) return [{ Role: 'System', Text: 'Could not find input field' }];

    await page.click(inputRef);
    await page.typeText(inputRef, prompt);
    await page.wait(1);

    await page.evaluate(`
      (function() {
        const btn = document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"]');
        if (btn && !btn.disabled) btn.click();
      })()
    `);

    const deadline = Date.now() + timeout * 1000;
    let prev = '';
    let stableCount = 0;

    while (Date.now() < deadline) {
      await page.wait(5);
      if (await isGenerating(page)) { stableCount = 0; continue; }
      const messages = await getVisibleChatMessagesFromPage(page);
      const latest = messages[messages.length - 1] ?? '';
      if (latest !== responseBefore && latest.length > 10) {
        if (latest === prev) {
          stableCount++;
          if (stableCount >= 2) return [{ Role: 'User', Text: prompt }, { Role: 'Assistant', Text: latest }];
        } else { stableCount = 0; prev = latest; }
      }
    }

    return [{ Role: 'System', Text: `Timeout after ${timeout}s` }];
  },
});
