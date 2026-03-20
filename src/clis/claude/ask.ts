import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { getLastClaudeResponse, isClaudeGenerating } from './ax.js';

export const askCommand = cli({
  site: 'claude',
  name: 'ask',
  description: 'Send a prompt to Claude.ai and wait for the response',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  timeoutSeconds: 300,
  args: [
    { name: 'prompt', required: true, positional: true, help: 'Prompt to send' },
    { name: 'timeout', required: false, help: 'Max seconds to wait (default: 120)', default: '120' },
  ],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const prompt = kwargs.prompt as string;
    const timeout = parseInt(kwargs.timeout as string, 10) || 120;

    const responseBefore = await getLastClaudeResponse(page);

    const snapshot = await page.snapshot({ interactive: true });
    const nodes = (snapshot?.nodes as any[]) ?? [];
    const inputRef =
      nodes.find((n: any) => n.role === 'textbox' && (n.id === 'prompt-textarea' || n.placeholder?.includes('Talk')))?.ref ??
      nodes.find((n: any) => n.role === 'textbox' || n.role === 'combobox')?.ref;

    if (!inputRef) throw new Error('Could not find Claude.ai input field');

    await page.click(inputRef);
    await page.typeText(inputRef, prompt);
    await page.wait(1);

    // Send
    const sent = await page.evaluate(`
      (function() {
        const btn = document.querySelector('button[aria-label*="Send"], [data-testid*="send"]');
        if (btn && !btn.disabled) { btn.click(); return true; }
        return false;
      })()
    `);
    if (!sent) await page.pressKey('Return');

    const deadline = Date.now() + timeout * 1000;
    let response = '';
    let prev = '';
    let stableCount = 0;

    while (Date.now() < deadline) {
      await page.wait(3);
      if (await isClaudeGenerating(page)) { stableCount = 0; continue; }
      const cur = await getLastClaudeResponse(page);
      if (cur && cur !== responseBefore && cur.length > 10) {
        if (cur === prev) {
          stableCount++;
          if (stableCount >= 2) { response = cur; break; }
        } else {
          stableCount = 0; prev = cur;
        }
      }
    }

    if (!response) return [{ Role: 'System', Text: `No response within ${timeout}s` }];
    return [{ Role: 'User', Text: prompt }, { Role: 'Assistant', Text: response }];
  },
});
