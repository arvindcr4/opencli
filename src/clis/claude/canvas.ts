import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const canvasCommand = cli({
  site: 'claude',
  name: 'canvas',
  description: 'Read or interact with Claude artifacts (the canvas/document view)',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'action', required: false, positional: true, help: 'Action: read | copy | expand (default: read)', choices: ['read', 'copy', 'expand'], default: 'read' },
  ],
  columns: ['Title', 'Content'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const action = (kwargs.action as string) || 'read';

    if (action === 'expand') {
      // Try to expand/maximize the artifact view
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
        // Claude artifacts
        const artifacts = Array.from(document.querySelectorAll(
          '[data-testid*="artifact"], [class*="artifact"], [class*="Artifact"], iframe.artifact'
        ));
        if (artifacts.length) {
          const last = artifacts[artifacts.length - 1];
          const title = last.getAttribute('data-title') || last.querySelector('h1,h2,h3')?.textContent?.trim() || 'Artifact';
          const content = (last.innerText || last.textContent || '').trim().slice(0, 3000);
          return JSON.stringify({ title, content });
        }
        // Fallback: check for code blocks or pre elements in last response
        const responses = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
        const lastResp = responses[responses.length - 1];
        if (lastResp) {
          const pre = lastResp.querySelector('pre code, pre');
          if (pre) return JSON.stringify({ title: 'Code Block', content: (pre.textContent || '').trim().slice(0, 3000) });
          return JSON.stringify({ title: 'Response', content: (lastResp.innerText || '').trim().slice(0, 3000) });
        }
        return JSON.stringify({ title: 'None', content: 'No artifacts found in current conversation' });
      })()
    `);

    let result = { title: 'None', content: 'No artifacts found' };
    try { result = JSON.parse(content as string); } catch { /* ignore */ }
    return [{ Title: result.title, Content: result.content.slice(0, 500) }];
  },
});
