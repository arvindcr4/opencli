import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const canvasCommand = cli({
  site: 'chatgpt',
  name: 'canvas',
  description: 'Interact with ChatGPT Canvas — read content, copy, or trigger canvas mode',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    { name: 'action', required: false, positional: true, help: 'Action: read | new (default: read)', choices: ['read', 'new'], default: 'read' },
    { name: 'prompt', required: false, help: 'Prompt to open canvas with (for new action)' },
  ],
  columns: ['Content'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const action = (kwargs.action as string) || 'read';
    const prompt = kwargs.prompt as string | undefined;

    if (action === 'new' && prompt) {
      const snapshot = await page.snapshot({ interactive: true });
      const nodes = (snapshot?.nodes as any[]) ?? [];
      const inputRef = nodes.find((n: any) => n.role === 'textbox' || n.role === 'combobox')?.ref;
      if (inputRef) {
        await page.click(inputRef);
        await page.typeText(inputRef, prompt);
        await page.wait(1);

        // Enable canvas mode
        await page.evaluate(`
          (function() {
            const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
            const canvasBtn = btns.find(b => {
              const label = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
              return label.includes('canvas') || label.includes('artifact');
            });
            if (canvasBtn) canvasBtn.click();
          })()
        `);
        await page.pressKey('Return');
        return [{ Content: 'Canvas prompt submitted' }];
      }
    }

    // Read canvas content
    const content = await page.evaluate(`
      (function() {
        const canvas = document.querySelector('[class*="canvas"], [data-testid*="canvas"], .artifact, [class*="artifact"]');
        if (canvas) return (canvas.innerText || canvas.textContent || '').trim().slice(0, 2000);
        // Fallback: look for code blocks or large text areas in the response
        const codeBlocks = Array.from(document.querySelectorAll('pre code, .code-block'));
        if (codeBlocks.length) {
          return codeBlocks.map((el: any) => (el.textContent || '').trim()).join('\n\n').slice(0, 2000);
        }
        return 'No canvas content found';
      })()
    `);

    return [{ Content: content as string }];
  },
});
