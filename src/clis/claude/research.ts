import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { isClaudeGenerating, getAllClaudeMessages } from './ax.js';

export const researchCommand = cli({
  site: 'claude',
  name: 'research',
  description: 'Submit a research query to Claude.ai with extended thinking enabled and wait for full report',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  timeoutSeconds: 3600,
  args: [
    { name: 'query', required: true, positional: true, help: 'Research query' },
    { name: 'timeout', required: false, help: 'Max seconds to wait (default: 1200)', default: '1200' },
    {
      name: 'model',
      required: false,
      help: 'Claude model to use: opus | sonnet | haiku (default: opus)',
      choices: ['opus', 'sonnet', 'haiku'],
      default: 'opus',
    },
  ],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const query = kwargs.query as string;
    const timeout = parseInt(kwargs.timeout as string, 10) || 1200;
    const model = (kwargs.model as string) || 'opus';

    await page.goto('https://claude.ai/new');
    await page.wait(3);

    // Try to switch to a more capable model if specified
    if (model !== 'sonnet') {
      await page.evaluate(`
        (function(targetModel) {
          const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
          const modelBtn = btns.find(b => {
            const t = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
            return t.includes('model') || t.includes('claude') || t.includes('sonnet') || t.includes('opus');
          });
          if (modelBtn) {
            modelBtn.click();
            setTimeout(() => {
              const items = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"], button, li'));
              const item = items.find(el => (el.textContent || '').toLowerCase().includes(targetModel));
              if (item) item.click();
            }, 500);
          }
        })(${JSON.stringify(model)})
      `);
      await page.wait(2);
    }

    // Enable extended thinking if available
    await page.evaluate(`
      (function() {
        const btns = Array.from(document.querySelectorAll('button, [role="switch"], label, [role="checkbox"]'));
        const thinkBtn = btns.find(b => {
          const t = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
          return t.includes('think') || t.includes('extended') || t.includes('reasoning');
        });
        if (thinkBtn && thinkBtn.getAttribute('aria-checked') !== 'true' &&
            !thinkBtn.classList.contains('active')) {
          thinkBtn.click();
        }
      })()
    `);
    await page.wait(1);

    const snapshot = await page.snapshot({ interactive: true });
    const nodes = (snapshot?.nodes as any[]) ?? [];
    const inputRef =
      nodes.find((n: any) => n.role === 'textbox' && n.id === 'prompt-textarea')?.ref ??
      nodes.find((n: any) => n.role === 'textbox' || n.role === 'combobox')?.ref;

    if (!inputRef) throw new Error('Could not find Claude.ai input field');

    const messagesBefore = await getAllClaudeMessages(page);
    await page.click(inputRef);
    await page.typeText(inputRef, query);
    await page.wait(1);

    const sent = await page.evaluate(`
      (function() {
        const btn = document.querySelector('button[aria-label*="Send"], [data-testid*="send"]');
        if (btn && !btn.disabled) { btn.click(); return true; }
        return false;
      })()
    `);
    if (!sent) await page.pressKey('Return');

    // Wait for full response
    const deadline = Date.now() + timeout * 1000;
    let lastText = '';
    let stableCount = 0;

    while (Date.now() < deadline) {
      await page.wait(8);

      const generating = await isClaudeGenerating(page);
      const messages = await getAllClaudeMessages(page);
      const newMessages = messages.slice(messagesBefore.length);
      const latest = newMessages.filter(m => m.role === 'assistant').pop()?.text ?? '';

      if (latest.length > 100) {
        if (latest === lastText && !generating) {
          stableCount++;
          if (stableCount >= 2) {
            return [{ Role: 'User', Text: query }, { Role: 'Assistant', Text: latest }];
          }
        } else {
          stableCount = 0;
        }
      }
      lastText = latest || '';
    }

    if (lastText.length > 50) return [{ Role: 'User', Text: query }, { Role: 'Assistant', Text: lastText }];
    return [{ Role: 'System', Text: `No report within ${timeout}s — check claude.ai` }];
  },
});
