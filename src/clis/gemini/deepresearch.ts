import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { isGeminiGenerating } from './ax.js';

export const deepresearchCommand = cli({
  site: 'gemini',
  name: 'deepresearch',
  description: 'Submit a Deep Research query to Gemini and wait for the full report',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  timeoutSeconds: 3600,
  args: [
    { name: 'query', required: true, positional: true, help: 'Research query' },
    { name: 'timeout', required: false, help: 'Max seconds to wait for report (default: 1800)', default: '1800' },
  ],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const query = kwargs.query as string;
    const timeout = parseInt(kwargs.timeout as string, 10) || 1800;

    // Navigate to Gemini Deep Research URL
    await page.goto('https://gemini.google.com/app?model=gemini-2.0-flash-thinking-exp');
    await page.wait(3);

    // Try to switch to Deep Research mode via the model switcher
    const switched = await page.evaluate(`
      (function() {
        const btns = Array.from(document.querySelectorAll('button, [role="button"], mat-select'));
        const modelBtn = btns.find(b => {
          const t = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
          return t.includes('gemini') || t.includes('model') || t.includes('deep research');
        });
        if (modelBtn) { modelBtn.click(); return true; }
        return false;
      })()
    `);

    if (switched) {
      await page.wait(1);
      // Look for Deep Research option
      await page.evaluate(`
        (function() {
          const items = Array.from(document.querySelectorAll('[role="option"], mat-option, li, button'));
          const drItem = items.find(el => {
            const t = (el.textContent || '').toLowerCase();
            return t.includes('deep research') || t.includes('research');
          });
          if (drItem) drItem.click();
        })()
      `);
      await page.wait(1);
    }

    // Find input and send query
    const snapshot = await page.snapshot({ interactive: true });
    const nodes = (snapshot?.nodes as any[]) ?? [];
    const inputRef =
      nodes.find((n: any) => n.role === 'textbox' && n.placeholder?.includes('Enter'))?.ref ??
      nodes.find((n: any) => n.role === 'textbox' || n.role === 'combobox')?.ref;

    if (!inputRef) throw new Error('Could not find Gemini input field');

    await page.click(inputRef);
    await page.typeText(inputRef, query);
    await page.wait(1);

    // Submit
    const sent = await page.evaluate(`
      (function() {
        const btn = document.querySelector('button[aria-label*="Send"], [data-mat-icon-name*="send"]');
        const sendBtn = btn?.closest ? (btn.closest('button') || btn) : btn;
        if (sendBtn) { sendBtn.click(); return true; }
        return false;
      })()
    `);
    if (!sent) await page.pressKey('Return');

    // Wait for research to complete — this can take very long
    const deadline = Date.now() + timeout * 1000;
    let lastText = '';
    let stableCount = 0;

    while (Date.now() < deadline) {
      await page.wait(10); // Poll every 10s for deep research

      const generating = await isGeminiGenerating(page);

      const currentText = await page.evaluate(`
        (function() {
          const responses = Array.from(document.querySelectorAll(
            'model-response, .model-response-text, [data-response-index], .response-content'
          ));
          if (!responses.length) return '';
          const last = responses[responses.length - 1];
          return (last.innerText || last.textContent || '').replace(/[\\uFFFC\\u200B-\\u200D\\uFEFF]/g, '').trim();
        })()
      `) as string;

      if (currentText && currentText.length > 100) {
        if (currentText === lastText && !generating) {
          stableCount++;
          if (stableCount >= 2) {
            return [{ Role: 'User', Text: query }, { Role: 'Assistant', Text: currentText }];
          }
        } else {
          stableCount = 0;
        }
      }
      lastText = currentText || '';
    }

    if (lastText && lastText.length > 50) {
      return [{ Role: 'User', Text: query }, { Role: 'Assistant', Text: lastText }];
    }
    return [{ Role: 'System', Text: `No report within ${timeout}s — check gemini.google.com` }];
  },
});
