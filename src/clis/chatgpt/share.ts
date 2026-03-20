import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const shareCommand = cli({
  site: 'chatgpt',
  name: 'share',
  description: 'Get or create a share link for the current ChatGPT conversation',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [],
  columns: ['URL', 'Status'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');

    // Click the share button
    const clicked = await page.evaluate(`
      (function() {
        // Try aria-label or title containing "share"
        const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
        const shareBtn = btns.find(b => {
          const label = (b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent || '').toLowerCase();
          return label.includes('share');
        });
        if (!shareBtn) return false;
        shareBtn.click();
        return true;
      })()
    `);

    if (!clicked) return [{ URL: '', Status: 'Share button not found — start a conversation first' }];

    // Wait for modal to appear
    await page.wait(1);

    // Extract share URL from modal input or link
    const shareUrl = await page.evaluate(`
      (function() {
        // Look for URL input in share modal
        const inputs = Array.from(document.querySelectorAll('input[type="text"], input[readonly]'));
        for (const inp of inputs) {
          const val = inp.value || '';
          if (val.includes('chatgpt.com/share') || val.includes('chat.openai.com/share')) return val;
        }
        // Look for copy button with URL nearby
        const links = Array.from(document.querySelectorAll('a[href*="share"], a[href*="/s/"]'));
        for (const a of links) {
          const href = a.getAttribute('href') || '';
          if (href) return href.startsWith('http') ? href : 'https://chatgpt.com' + href;
        }
        return null;
      })()
    `);

    // Close modal
    await page.evaluate(`
      (function() {
        const closeBtn = document.querySelector('[data-testid="modal-close-button"], button[aria-label="Close"], button[aria-label="close"]');
        if (closeBtn) closeBtn.click();
      })()
    `);

    if (!shareUrl) return [{ URL: '', Status: 'Could not extract share URL from modal' }];
    return [{ URL: shareUrl as string, Status: 'OK' }];
  },
});
