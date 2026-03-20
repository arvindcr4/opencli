import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { getLastClaudeResponse, isClaudeGenerating } from './ax.js';

export const codeCommand = cli({
  site: 'claude',
  name: 'code',
  description: 'Ask Claude to write, review, or debug code and get the response',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  timeoutSeconds: 600,
  args: [
    { name: 'prompt', required: true, positional: true, help: 'Code task (write/debug/review)' },
    { name: 'lang', required: false, help: 'Programming language hint (optional)' },
    { name: 'timeout', required: false, help: 'Max seconds to wait (default: 180)', default: '180' },
  ],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const lang = kwargs.lang as string | undefined;
    const fullPrompt = lang ? `[${lang}] ${kwargs.prompt}` : kwargs.prompt as string;
    const timeout = parseInt(kwargs.timeout as string, 10) || 180;

    const snapshot = await page.snapshot({ interactive: true });
    const nodes = (snapshot?.nodes as any[]) ?? [];
    const inputRef = nodes.find((n: any) => n.role === 'textbox')?.ref;
    if (!inputRef) return [{ Role: 'System', Text: 'Could not find input field' }];

    await page.click(inputRef);
    await page.typeText(inputRef, fullPrompt);
    await page.wait(1);

    const sent = await page.evaluate(`
      (function() {
        const btn = document.querySelector('button[aria-label*="Send"], button[data-testid*="send"], button[type="submit"]');
        if (btn && !btn.disabled) { btn.click(); return true; }
        return false;
      })()
    `);
    if (!sent) await page.pressKey('Return');

    const deadline = Date.now() + timeout * 1000;
    let prev = '';
    let stableCount = 0;

    while (Date.now() < deadline) {
      await page.wait(3);
      if (await isClaudeGenerating(page)) { stableCount = 0; continue; }
      const cur = await getLastClaudeResponse(page);
      if (cur && cur.length > 20) {
        if (cur === prev) {
          stableCount++;
          if (stableCount >= 2) return [{ Role: 'User', Text: fullPrompt }, { Role: 'Assistant', Text: cur }];
        } else { stableCount = 0; prev = cur; }
      }
    }

    return [{ Role: 'System', Text: `Timeout after ${timeout}s` }];
  },
});
