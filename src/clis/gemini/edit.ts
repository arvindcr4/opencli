import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const editCommand = cli({
  site: 'gemini',
  name: 'edit',
  description: 'Edit the last user message in the current gemini conversation',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'text', required: true, positional: true, help: 'New message text to replace with' },
  ],
  columns: ['Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const text = kwargs.text as string;

    // Find and click the edit button on the last user message
    const editClicked = await page.evaluate(`
      (function() {
        const userMsgs = Array.from(document.querySelectorAll(
          '[data-message-author-role="user"], .user-message, [data-testid="user-message"], user-query'
        ));
        if (!userMsgs.length) return 'no_messages';
        const lastMsg = userMsgs[userMsgs.length - 1];
        lastMsg.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        const editBtn = lastMsg.querySelector('button[aria-label*="edit" i], button[data-testid*="edit"]');
        if (editBtn) { editBtn.click(); return 'found_btn'; }
        // Try hovering parent
        const parent = lastMsg.closest('[class*="message"], [class*="turn"]') || lastMsg.parentElement;
        if (parent) {
          parent.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          const btn2 = parent.querySelector('button[aria-label*="edit" i]');
          if (btn2) { btn2.click(); return 'found_parent_btn'; }
        }
        return 'no_edit_btn';
      })()
    `);

    if (editClicked === 'no_messages') return [{ Status: 'No user messages found' }];
    if (editClicked === 'no_edit_btn') return [{ Status: 'Edit button not found — hover over message to reveal it' }];

    await page.wait(1);

    // Clear existing text and type new text
    await page.evaluate(`
      (function() {
        const textarea = document.querySelector('textarea:focus, [contenteditable="true"]:focus, textarea.edit-input, [class*="edit"] textarea');
        if (textarea) {
          textarea.focus();
          document.execCommand('selectAll');
        }
      })()
    `);

    await page.evaluate(`document.execCommand('selectAll')`);
    await page.typeText('', text);

    // Submit the edit
    await page.evaluate(`
      (function() {
        const submitBtn = Array.from(document.querySelectorAll('button')).find(b =>
          /save|send|submit|confirm/i.test(b.textContent || b.getAttribute('aria-label') || '')
        );
        if (submitBtn) submitBtn.click();
      })()
    `);

    return [{ Status: 'Edit submitted' }];
  },
});
