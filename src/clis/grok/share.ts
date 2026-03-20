import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const shareCommand = cli({
  site: 'grok',
  name: 'share',
  description: 'Get or create a share link for the current Grok conversation',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [],
  columns: ['URL', 'Status'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');

    const clicked = await page.evaluate(`
      (function() {
        const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
        const shareBtn = btns.find(b => {
          const label = (b.getAttribute('aria-label') || b.title || b.textContent || '').toLowerCase();
          return label.includes('share');
        });
        if (shareBtn) { shareBtn.click(); return true; }
        return false;
      })()
    `);

    if (!clicked) return [{ URL: '', Status: 'Share button not found' }];

    await page.wait(2);

    const shareUrl = await page.evaluate(`
      (function() {
        const inputs = Array.from(document.querySelectorAll('input[readonly], input[type="text"]'));
        for (const inp of inputs) {
          const val = inp.value || '';
          if (val.includes('grok.com') || val.includes('/share/') || val.includes('/s/')) return val;
        }
        const links = Array.from(document.querySelectorAll('a[href*="share"], a[href*="/s/"]'));
        for (const a of links) {
          const href = a.getAttribute('href') || '';
          if (href) return href.startsWith('http') ? href : 'https://grok.com' + href;
        }
        return null;
      })()
    `);

    await page.evaluate(`
      (function() {
        const closeBtn = document.querySelector('[aria-label*="close" i], button.close, [data-testid="close"]');
        if (closeBtn) closeBtn.click();
      })()
    `);

    if (!shareUrl) return [{ URL: '', Status: 'Share URL not found' }];
    return [{ URL: shareUrl as string, Status: 'OK' }];
  },
});
