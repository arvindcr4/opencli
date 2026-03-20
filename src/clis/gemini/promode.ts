import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { getLastGeminiResponse, isGeminiGenerating } from './ax.js';

export const promodeCommand = cli({
  site: 'gemini',
  name: 'promode',
  description: 'Send a prompt to Gemini 2.0 Pro with extended thinking and wait for the full response',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  timeoutSeconds: 3600,
  args: [
    { name: 'prompt', required: true, positional: true, help: 'Prompt to send' },
    { name: 'timeout', required: false, help: 'Max seconds to wait (default: 1800)', default: '1800' },
    { name: 'model', required: false, help: 'Model: pro | flash | ultra (default: pro)', choices: ['pro', 'flash', 'ultra'], default: 'pro' },
  ],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const prompt = kwargs.prompt as string;
    const timeout = parseInt(kwargs.timeout as string, 10) || 1800;
    const model = (kwargs.model as string) || 'pro';

    const modelMap: Record<string, string> = {
      pro: 'gemini-2.0-pro-exp',
      flash: 'gemini-2.0-flash-thinking-exp',
      ultra: 'gemini-ultra',
    };
    const modelId = modelMap[model] || 'gemini-2.0-pro-exp';

    await page.goto(`https://gemini.google.com/app?model=${modelId}`);
    await page.wait(4);

    const responseBefore = await getLastGeminiResponse(page);

    const snapshot = await page.snapshot({ interactive: true });
    const nodes = (snapshot?.nodes as any[]) ?? [];
    const inputRef =
      nodes.find((n: any) => n.role === 'textbox' && (n.name?.includes('Enter') || n.placeholder?.includes('Enter')))?.ref ??
      nodes.find((n: any) => n.role === 'textbox' || n.role === 'combobox')?.ref;

    if (!inputRef) return [{ Role: 'System', Text: 'Could not find Gemini input field' }];

    await page.click(inputRef);
    await page.typeText(inputRef, prompt);
    await page.wait(1);

    const sent = await page.evaluate(`
      (function() {
        const btn = document.querySelector('button[aria-label*="Send"], button[data-mat-icon-name*="send"]');
        const sendBtn = btn?.closest ? (btn.closest('button') || btn) : btn;
        if (sendBtn) { sendBtn.click(); return true; }
        return false;
      })()
    `);
    if (!sent) await page.pressKey('Return');

    const deadline = Date.now() + timeout * 1000;
    let prev = '';
    let stableCount = 0;

    while (Date.now() < deadline) {
      await page.wait(10);
      if (await isGeminiGenerating(page)) { stableCount = 0; continue; }
      const cur = await getLastGeminiResponse(page);
      if (cur && cur !== responseBefore && cur.length > 50) {
        if (cur === prev) {
          stableCount++;
          if (stableCount >= 3) return [{ Role: 'User', Text: prompt }, { Role: 'Assistant', Text: cur }];
        } else { stableCount = 0; prev = cur; }
      }
    }

    return [{ Role: 'System', Text: `Timeout after ${timeout}s — response: ${prev.slice(0, 100)}` }];
  },
});
