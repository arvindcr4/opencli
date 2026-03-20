import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const expandCommand = cli({
  site: 'grok',
  name: 'expand',
  description: 'Ask Grok to expand and elaborate on its last response',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'focus', required: false, positional: true, help: 'Specific aspect to expand on (optional)' },
  ],
  columns: ['Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const focus = kwargs.focus as string | undefined;
    const prompt = focus
      ? `Please expand on your previous response, focusing specifically on: ${focus}. Provide more detail, examples, and deeper analysis.`
      : 'Please expand on your previous response. Provide more detail, examples, and deeper analysis on the key points.';

    await page.evaluate(`
      (function(msg) {
        const el = document.querySelector('textarea, [contenteditable="true"]');
        if (el) { el.focus(); document.execCommand('selectAll'); document.execCommand('insertText', false, msg); }
      })(${JSON.stringify(prompt)})
    `);
    await page.wait(300);
    const sent = await page.evaluate(`
      (function() {
        const btn = document.querySelector('[aria-label*="Send"]') || document.querySelector('[data-testid="send-button"]');
        if (btn) { btn.click(); return true; }
        return false;
      })()
    `);
    if (!sent) await page.pressKey('Enter');
    return [{ Status: 'Sent: expanding response' }];
  },
});
