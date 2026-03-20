/**
 * Gemini shared utilities — DOM helpers for gemini.google.com
 */
import type { IPage } from '../../types.js';

export async function getLastGeminiResponse(page: IPage): Promise<string> {
  const result = await page.evaluate(`
    (function() {
      // Gemini uses model-response elements
      const responses = Array.from(document.querySelectorAll(
        'model-response, .model-response-text, [data-response-index], .response-content, message-content'
      ));
      if (!responses.length) {
        // Fallback: look for markdown containers after user turns
        const all = Array.from(document.querySelectorAll('.markdown, .response-text, [class*="ResponseText"]'));
        if (!all.length) return '';
        return (all[all.length - 1].innerText || '').trim();
      }
      const last = responses[responses.length - 1];
      return (last.innerText || last.textContent || '').trim();
    })()
  `);
  return (result as string) || '';
}

export async function getAllGeminiMessages(page: IPage): Promise<Array<{ role: string; text: string }>> {
  const result = await page.evaluate(`
    (function() {
      const messages = [];
      // User queries
      const userTurns = Array.from(document.querySelectorAll('user-query, .user-query, [data-message-author="user"]'));
      // Model responses
      const modelTurns = Array.from(document.querySelectorAll('model-response, .model-response, [data-message-author="model"]'));

      // Interleave by DOM order
      const allTurns = Array.from(document.querySelectorAll(
        'user-query, model-response, .user-query, .model-response, [data-message-author]'
      ));

      for (const el of allTurns) {
        const role = el.tagName.toLowerCase().includes('user') ||
          el.getAttribute('data-message-author') === 'user' ||
          el.classList.contains('user-query') ? 'user' : 'assistant';
        const text = (el.innerText || el.textContent || '').replace(/[\\uFFFC\\u200B-\\u200D\\uFEFF]/g, '').trim();
        if (text) messages.push({ role, text });
      }
      return JSON.stringify(messages);
    })()
  `);
  try { return JSON.parse(result as string); } catch { return []; }
}

export async function isGeminiGenerating(page: IPage): Promise<boolean> {
  const result = await page.evaluate(`
    (function() {
      // Loading spinner or stop button
      if (document.querySelector('[aria-label*="Stop"], [data-mat-icon-name="stop"], .stop-button')) return true;
      const btns = Array.from(document.querySelectorAll('button'));
      if (btns.some(b => /stop/i.test(b.getAttribute('aria-label') || b.textContent || ''))) return true;
      if (document.querySelector('.loading, .generating, [class*="loading"]')) return true;
      return false;
    })()
  `);
  return !!result;
}
