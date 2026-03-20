import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { getVisibleChatMessagesFromPage } from './ax.js';

async function isGenerating(page: IPage): Promise<boolean> {
  const result = await page.evaluate(`
    (function() {
      if (document.querySelector('[data-testid="stop-button"]')) return true;
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => /^stop/i.test((b.textContent || b.getAttribute('aria-label') || '').trim()));
    })()
  `);
  return !!result;
}

export const thinkCommand = cli({
  site: 'chatgpt',
  name: 'think',
  description: 'Ask ChatGPT o3 (reasoning/thinking model) and wait for the deep analysis',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  timeoutSeconds: 3600,
  args: [
    { name: 'prompt', required: true, positional: true, help: 'Prompt requiring deep reasoning' },
    { name: 'model', required: false, help: 'Reasoning model: o3 | o3-mini | o1 (default: o3)', choices: ['o3', 'o3-mini', 'o1'], default: 'o3' },
    { name: 'timeout', required: false, help: 'Max seconds to wait (default: 1800)', default: '1800' },
  ],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const prompt = kwargs.prompt as string;
    const model = (kwargs.model as string) || 'o3';
    const timeout = parseInt(kwargs.timeout as string, 10) || 1800;

    await page.goto('https://chatgpt.com/');
    await page.wait(3);

    // Switch to reasoning model
    const modelAliases: Record<string, RegExp> = {
      'o3': /^o3$/i,
      'o3-mini': /o3.mini/i,
      'o1': /^o1$/i,
    };
    const modelPattern = modelAliases[model] || /o3/i;

    await page.evaluate(`
      (function() {
        const selectors = ['button[aria-haspopup="listbox"]', 'button[aria-haspopup="menu"]', '[class*="model"] button'];
        for (const sel of selectors) {
          const btn = document.querySelector(sel);
          if (btn) { btn.click(); return; }
        }
      })()
    `);
    await page.wait(1);
    await page.evaluate(`
      (function(pattern) {
        const options = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"]'));
        const opt = options.find(el => new RegExp(pattern).test(el.textContent || ''));
        if (opt) opt.click();
      })(${JSON.stringify(modelPattern.source)})
    `);
    await page.wait(2);

    const responseBefore = (await getVisibleChatMessagesFromPage(page)).pop() ?? '';

    const snapshot = await page.snapshot({ interactive: true });
    const nodes = (snapshot?.nodes as any[]) ?? [];
    const inputRef = nodes.find((n: any) =>
      (n.role === 'textbox' || n.role === 'combobox') && !n.name?.toLowerCase().includes('model')
    )?.ref;

    if (!inputRef) return [{ Role: 'System', Text: 'Could not find input field' }];

    await page.click(inputRef);
    await page.typeText(inputRef, prompt);
    await page.wait(1);

    await page.evaluate(`
      (function() {
        const btn = document.querySelector('button[data-testid="send-button"]');
        if (btn && !btn.disabled) btn.click();
      })()
    `);

    const deadline = Date.now() + timeout * 1000;
    let prev = '';
    let stableCount = 0;

    while (Date.now() < deadline) {
      await page.wait(10);
      if (await isGenerating(page)) { stableCount = 0; continue; }
      const messages = await getVisibleChatMessagesFromPage(page);
      const latest = messages[messages.length - 1] ?? '';
      if (latest !== responseBefore && latest.length > 50) {
        if (latest === prev) {
          stableCount++;
          if (stableCount >= 3) return [{ Role: 'User', Text: prompt }, { Role: 'Assistant', Text: latest }];
        } else { stableCount = 0; prev = latest; }
      }
    }

    return [{ Role: 'System', Text: `Timeout — partial: ${prev.slice(0, 100)}` }];
  },
});
