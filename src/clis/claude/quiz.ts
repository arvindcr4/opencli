import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const quizCommand = cli({
  site: 'claude',
  name: 'quiz',
  description: 'Ask Claude to generate quiz questions from the current conversation',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'count', required: false, help: 'Number of questions (default: 5)', default: '5' },
    {
      name: 'type',
      required: false,
      help: 'Question type: mcq | open | truefalse | mixed (default: mixed)',
      choices: ['mcq', 'open', 'truefalse', 'mixed'],
      default: 'mixed',
    },
  ],
  columns: ['Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const count = parseInt(kwargs.count as string || '5', 10);
    const type = (kwargs.type as string) || 'mixed';
    const typeDesc: Record<string, string> = {
      mcq: 'multiple choice questions with 4 options each',
      open: 'open-ended questions',
      truefalse: 'true/false questions',
      mixed: 'a mix of multiple choice, true/false, and open-ended questions',
    };
    const prompt = `Please generate ${count} ${typeDesc[type] || typeDesc.mixed} based on the content of our conversation. Include the answers at the end.`;

    await page.evaluate(`
      (function(msg) {
        const el = document.querySelector('[contenteditable="true"]') || document.querySelector('textarea[placeholder]');
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
    return [{ Status: `Sent: generating ${count} ${type} questions` }];
  },
});
