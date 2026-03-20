import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const insightsCommand = cli({
  site: 'chatgpt',
  name: 'insights',
  description: 'Extract key insights, action items, or decisions from the current ChatGPT conversation',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  timeoutSeconds: 300,
  args: [
    { name: 'type', required: false, positional: true, help: 'Type: insights | actions | decisions | questions (default: insights)', choices: ['insights', 'actions', 'decisions', 'questions'], default: 'insights' },
    { name: 'timeout', required: false, help: 'Max seconds to wait (default: 60)', default: '60' },
  ],
  columns: ['Type', 'Items'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const type = (kwargs.type as string) || 'insights';
    const timeout = parseInt(kwargs.timeout as string, 10) || 60;

    const promptMap: Record<string, string> = {
      insights: 'Extract the 3-5 most important insights from our conversation. List each insight on a new line with a dash.',
      actions: 'List all action items or next steps mentioned in our conversation. Format as a numbered list.',
      decisions: 'What key decisions were made or recommended in our conversation? List each on a new line.',
      questions: 'What are the key questions that remain unanswered from our conversation? List each on a new line.',
    };

    const prompt = promptMap[type] || promptMap.insights;
    const snapshot = await page.snapshot({ interactive: true });
    const nodes = (snapshot?.nodes as any[]) ?? [];
    const inputRef = nodes.find((n: any) => n.role === 'textbox' || n.role === 'combobox')?.ref;

    if (!inputRef) return [{ Type: type, Items: 'Could not find input field' }];

    await page.click(inputRef);
    await page.typeText(inputRef, prompt);
    await page.wait(1);
    await page.evaluate(`
      (function() {
        const btn = document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"]');
        if (btn && !btn.disabled) btn.click();
      })()
    `);

    const deadline = Date.now() + timeout * 1000;
    let prev = '';
    let stableCount = 0;

    while (Date.now() < deadline) {
      await page.wait(3);
      const generating = await page.evaluate(`!!document.querySelector('[data-testid="stop-button"]')`);
      if (generating) { stableCount = 0; continue; }
      const response = await page.evaluate(`
        (function() {
          const msgs = Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'));
          const last = msgs[msgs.length - 1];
          return last ? (last.innerText || '').trim() : '';
        })()
      `) as string;
      if (response && response.length > 10) {
        if (response === prev) { stableCount++; if (stableCount >= 2) return [{ Type: type, Items: response }]; }
        else { stableCount = 0; prev = response; }
      }
    }

    return [{ Type: type, Items: prev || 'Timeout' }];
  },
});
