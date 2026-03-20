import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const formatCommand = cli({
  site: 'gemini',
  name: 'format',
  description: 'Ask Gemini to reformat the last response in a specific style',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    {
      name: 'style',
      required: false,
      positional: true,
      help: 'Output format: bullets | table | json | plain | markdown | numbered (default: bullets)',
      choices: ['bullets', 'table', 'json', 'plain', 'markdown', 'numbered'],
      default: 'bullets',
    },
  ],
  columns: ['Status', 'Style'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const style = (kwargs.style as string) || 'bullets';
    const styleMap: Record<string, string> = {
      bullets: 'bullet points',
      table: 'a markdown table',
      json: 'valid JSON',
      plain: 'plain text without any markdown',
      markdown: 'well-structured markdown with headers',
      numbered: 'a numbered list',
    };
    const prompt = `Please reformat your previous response as ${styleMap[style] || style}. Keep the same content but change only the structure/format.`;

    await page.evaluate(`
      (function(msg) {
        const el = document.querySelector('rich-textarea [contenteditable], .ql-editor, textarea');
        if (el) { el.focus(); document.execCommand('selectAll'); document.execCommand('insertText', false, msg); }
      })(${JSON.stringify(prompt)})
    `);
    await page.wait(300);
    const sent = await page.evaluate(`
      (function() {
        const btn = document.querySelector('button[aria-label*="Send"]') || document.querySelector('[data-testid="send-button"]');
        if (btn) { btn.click(); return true; }
        return false;
      })()
    `);
    if (!sent) await page.pressKey('Enter');
    return [{ Status: 'Sent', Style: style }];
  },
});
