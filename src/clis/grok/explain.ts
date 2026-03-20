import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const explainCommand = cli({
  site: 'grok',
  name: 'explain',
  description: 'Ask Grok to explain its last response in simpler terms',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    {
      name: 'level',
      required: false,
      positional: true,
      help: 'Explanation level: eli5 | simple | detailed (default: simple)',
      choices: ['eli5', 'simple', 'detailed'],
      default: 'simple',
    },
  ],
  columns: ['Status', 'Level'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const level = (kwargs.level as string) || 'simple';
    const levelMap: Record<string, string> = {
      eli5: "explain it like I'm five years old, using very simple language and analogies",
      simple: 'explain it in simpler terms that are easier to understand',
      detailed: 'explain it in more detail with examples, covering edge cases and nuances',
    };
    const prompt = `Please ${levelMap[level] || levelMap.simple}.`;

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
    return [{ Status: 'Sent', Level: level }];
  },
});
