/**
 * Claude.ai shared utilities
 */
import type { IPage } from '../../types.js';

export async function getLastClaudeResponse(page: IPage): Promise<string> {
  const result = await page.evaluate(`
    (function() {
      // Claude uses [data-is-streaming] and [data-message-author-role]
      const responses = Array.from(document.querySelectorAll(
        '[data-message-author-role="assistant"], .assistant-message, [class*="AssistantMessage"]'
      ));
      if (!responses.length) return '';
      const last = responses[responses.length - 1];
      return (last.innerText || last.textContent || '').replace(/[\\uFFFC\\u200B-\\u200D\\uFEFF]/g, '').trim();
    })()
  `);
  return (result as string) || '';
}

export async function getAllClaudeMessages(page: IPage): Promise<Array<{ role: string; text: string }>> {
  const result = await page.evaluate(`
    (function() {
      const turns = Array.from(document.querySelectorAll('[data-message-author-role]'));
      return JSON.stringify(turns.map(el => ({
        role: el.getAttribute('data-message-author-role') || 'unknown',
        text: (el.innerText || el.textContent || '').replace(/[\\uFFFC\\u200B-\\u200D\\uFEFF]/g, '').trim(),
      })));
    })()
  `);
  try { return JSON.parse(result as string); } catch { return []; }
}

export async function isClaudeGenerating(page: IPage): Promise<boolean> {
  const result = await page.evaluate(`
    (function() {
      if (document.querySelector('[data-is-streaming="true"]')) return true;
      if (document.querySelector('.streaming, [class*="streaming"]')) return true;
      const btns = Array.from(document.querySelectorAll('button'));
      if (btns.some(b => /stop/i.test(b.getAttribute('aria-label') || b.textContent || ''))) return true;
      return false;
    })()
  `);
  return !!result;
}
