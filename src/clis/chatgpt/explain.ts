import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const explainCommand = cli({
  site: 'chatgpt',
  name: 'explain',
  description: 'Ask ChatGPT to explain its last response in simpler terms',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
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

    const inputSel = '#prompt-textarea, [data-testid="prompt-textarea"]';
    await page.click(inputSel);
    await page.evaluate(`
      (function(msg) {
        const el = document.querySelector('#prompt-textarea, [data-testid="prompt-textarea"], textarea');
        if (el) { el.focus(); document.execCommand('selectAll'); document.execCommand('insertText', false, msg); }
      })(${JSON.stringify(prompt)})
    `);
    await page.wait(300);
    await page.pressKey('Enter');
    return [{ Status: 'Sent', Level: level }];
  },
});
