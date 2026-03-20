import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const canvasCommand = cli({
  site: 'gemini',
  name: 'canvas',
  description: 'View or interact with Gemini canvas (document/code workspace)',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'action', required: false, positional: true, help: 'Action: read | expand (default: read)', choices: ['read', 'expand'], default: 'read' },
  ],
  columns: ['Title', 'Content'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const action = (kwargs.action as string) || 'read';

    if (action === 'expand') {
      await page.evaluate(`
        (function() {
          const expandBtn = Array.from(document.querySelectorAll('button')).find(b =>
            /expand|full.screen|maximize/i.test(b.getAttribute('aria-label') || b.textContent || '')
          );
          if (expandBtn) expandBtn.click();
        })()
      `);
      await page.wait(1);
    }

    const content = await page.evaluate(`
      (function() {
        // Gemini canvas/docs
        const canvas = document.querySelector('[class*="canvas"], [class*="Canvas"], .canvas-content, [data-canvas]');
        if (canvas) {
          return JSON.stringify({ title: 'Canvas', content: (canvas.innerText || canvas.textContent || '').trim().slice(0, 3000) });
        }
        // Check code execution output
        const codeOutput = document.querySelector('[class*="code-output"], [class*="execution-result"]');
        if (codeOutput) {
          return JSON.stringify({ title: 'Code Output', content: (codeOutput.textContent || '').trim().slice(0, 1000) });
        }
        // Check last response for code blocks
        const responses = Array.from(document.querySelectorAll('model-response, .model-response'));
        const last = responses[responses.length - 1];
        if (last) {
          const pre = last.querySelector('pre code, pre');
          if (pre) return JSON.stringify({ title: 'Code Block', content: (pre.textContent || '').trim().slice(0, 3000) });
        }
        return JSON.stringify({ title: 'None', content: 'No canvas content found' });
      })()
    `);

    let result = { title: 'None', content: 'No canvas found' };
    try { result = JSON.parse(content as string); } catch { /* ignore */ }
    return [{ Title: result.title, Content: result.content.slice(0, 500) }];
  },
});
