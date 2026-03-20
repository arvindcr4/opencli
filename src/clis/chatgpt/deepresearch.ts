import { cli, Strategy } from '../../registry.js';
import { getVisibleChatMessagesFromPage } from './ax.js';
import type { IPage } from '../../types.js';

/**
 * Read the deep research report from the page.
 */
async function getDeepResearchReport(page: IPage): Promise<string[]> {
  const result = await page.evaluate(`
    (function() {
      const selectors = [
        '[data-message-author-role="assistant"]',
        '.agent-turn',
        '[class*="deep-research"]',
        '[class*="assistant"]',
      ];
      for (const sel of selectors) {
        const els = Array.from(document.querySelectorAll(sel));
        if (els.length > 0) {
          return els.map((el: any) => (el.innerText || el.textContent || '').trim()).filter(Boolean);
        }
      }
      return [];
    })()
  `);
  if (!Array.isArray(result)) return [];
  return result
    .map((s: string) => s.replace(/[\uFFFC\u200B-\u200D\uFEFF]/g, '').trim())
    .filter((s: string) => s.length > 0);
}

/** Returns true if deep research is still in progress. */
async function isResearching(page: IPage): Promise<boolean> {
  const result = await page.evaluate(`
    (function() {
      const indicators = [
        '[data-testid="loading-indicator"]',
        '[class*="loading"]',
        '[class*="spinner"]',
      ];
      for (const sel of indicators) {
        if (document.querySelector(sel)) return true;
      }
      const buttons = Array.from(document.querySelectorAll('button'));
      if ((buttons as any[]).some((b: any) => (b.innerText || '').toLowerCase().includes('stop'))) return true;
      if (/searching\s+\d+/i.test(document.body.innerText || '')) return true;
      return false;
    })()
  `);
  return !!result;
}

export const deepresearchCommand = cli({
  site: 'chatgpt',
  name: 'deepresearch',
  description: 'Submit a deep research query to ChatGPT and wait for the full report',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  timeoutSeconds: 1800,
  args: [
    { name: 'text', required: true, positional: true, help: 'Research query' },
    { name: 'timeout', required: false, help: 'Max seconds to wait for report (default: 900)', default: '900' },
  ],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null, kwargs: Record<string, any>) => {
    const text = kwargs.text as string;
    const timeout = parseInt(kwargs.timeout as string, 10) || 900;

    if (!page) throw new Error('Browser page not available');

    await page.goto('https://chatgpt.com/deep-research');
    await page.wait(3);

    const snapshot = await page.snapshot({ interactive: true });
    const inputRef =
      snapshot?.nodes?.find((n: any) => n.role === 'textbox' && n.id === 'prompt-textarea')?.ref ??
      snapshot?.nodes?.find((n: any) => n.role === 'textbox' && n.placeholder?.toLowerCase().includes('report'))?.ref ??
      snapshot?.nodes?.find((n: any) => n.role === 'textbox' && n.name?.includes('prompt'))?.ref;

    if (!inputRef)
      throw new Error('Could not find deep research input field — make sure chatgpt.com is open and logged in');

    const messagesBefore = await getDeepResearchReport(page);

    await page.click(inputRef);
    await page.typeText(inputRef, text);
    await page.pressKey('Return');

    const deadline = Date.now() + timeout * 1000;
    let report = '';

    while (Date.now() < deadline) {
      await page.wait(5);
      const messagesNow = await getDeepResearchReport(page);
      if (messagesNow.length > messagesBefore.length) {
        const candidate = [...messagesNow.slice(messagesBefore.length)]
          .reverse()
          .find((m) => m !== text);
        if (candidate && candidate.length > 50) {
          let prev = candidate;
          let stableCount = 0;
          for (let i = 0; i < 60; i++) {
            await page.wait(5);
            if (await isResearching(page)) { stableCount = 0; continue; }
            const latest = await getDeepResearchReport(page);
            const cur = [...latest.slice(messagesBefore.length)].reverse().find((m) => m !== text) || prev;
            if (cur === prev) { stableCount++; if (stableCount >= 2) break; }
            else { stableCount = 0; prev = cur; }
          }
          report = prev;
          break;
        }
      }
    }

    if (!report) {
      return [
        { Role: 'User', Text: text },
        { Role: 'System', Text: `No report within ${timeout}s. Deep research may still be running — check chatgpt.com.` },
      ];
    }
    return [{ Role: 'User', Text: text }, { Role: 'Assistant', Text: report }];
  },
});
