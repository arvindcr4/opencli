import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { getLastGeminiResponse, isGeminiGenerating } from './ax.js';

export const askCommand = cli({
  site: 'gemini',
  name: 'ask',
  description: 'Send a prompt to Gemini and wait for the response',
  domain: 'gemini.google.com',
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

    await page.goto('https://gemini.google.com/app');
    await page.wait(3);

    const responseBefore = await getLastGeminiResponse(page);

    // Find input and type
    const snapshot = await page.snapshot({ interactive: true });
    const nodes = (snapshot?.nodes as any[]) ?? [];
    const inputRef =
      nodes.find((n: any) => n.role === 'textbox' && (n.name?.includes('Enter') || n.placeholder?.includes('Enter')))?.ref ??
      nodes.find((n: any) => n.role === 'textbox' || n.role === 'combobox')?.ref;

    if (!inputRef) throw new Error('Could not find Gemini input field');

    await page.click(inputRef);
    await page.typeText(inputRef, prompt);
    await page.wait(1);

    // Submit
    const sent = await page.evaluate(`
      (function() {
        const btn = document.querySelector('button[aria-label*="Send"], button[data-mat-icon-name*="send"], mat-icon[fontIcon="send"]');
        const sendBtn = btn?.closest ? (btn.closest('button') || btn) : btn;
        if (sendBtn) { sendBtn.click(); return true; }
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
      if (await isGeminiGenerating(page)) { stableCount = 0; continue; }
      const cur = await getLastGeminiResponse(page);
      if (cur && cur !== responseBefore && cur.length > 10) {
        if (cur === prev) {
          stableCount++;
          if (stableCount >= 2) { response = cur; break; }
        } else {
          stableCount = 0;
          prev = cur;
        }
      }
    }

    if (!response) return [{ Role: 'System', Text: `No response within ${timeout}s` }];
    return [{ Role: 'User', Text: prompt }, { Role: 'Assistant', Text: response }];
  },
});
