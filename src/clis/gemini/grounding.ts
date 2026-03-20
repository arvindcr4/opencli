import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const groundingCommand = cli({
  site: 'gemini',
  name: 'grounding',
  description: 'Toggle Google Search grounding on/off for Gemini responses',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'action', required: false, positional: true, help: 'Action: on | off | status (default: status)', choices: ['on', 'off', 'status'], default: 'status' },
  ],
  columns: ['Feature', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const action = (kwargs.action as string) || 'status';

    const current = await page.evaluate(`
      (function() {
        const searchToggle = document.querySelector(
          '[data-testid*="search"], [aria-label*="search" i][role="switch"], mat-slide-toggle[aria-label*="search" i]'
        );
        if (!searchToggle) return null;
        const isOn = searchToggle.getAttribute('aria-checked') === 'true';
        return isOn;
      })()
    `);

    if (action === 'status') {
      if (current === null) return [{ Feature: 'Google Search grounding', Status: 'Toggle not found on page' }];
      return [{ Feature: 'Google Search grounding', Status: current ? 'On' : 'Off' }];
    }

    const shouldBeOn = action === 'on';
    if (current === shouldBeOn) return [{ Feature: 'Google Search grounding', Status: `Already ${action}` }];

    const toggled = await page.evaluate(`
      (function() {
        const searchToggle = document.querySelector(
          '[data-testid*="search"], [aria-label*="search" i][role="switch"], mat-slide-toggle[aria-label*="search" i]'
        );
        if (searchToggle) { searchToggle.click(); return true; }
        const btns = Array.from(document.querySelectorAll('button, [role="switch"]'));
        const btn = btns.find(b => /google.search|grounding|search.on/i.test(b.getAttribute('aria-label') || b.textContent || ''));
        if (btn) { btn.click(); return true; }
        return false;
      })()
    `);

    return [{ Feature: 'Google Search grounding', Status: toggled ? `Turned ${action}` : 'Toggle not found' }];
  },
});
