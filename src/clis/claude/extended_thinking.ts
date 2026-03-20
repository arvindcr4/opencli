import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const extendedThinkingCommand = cli({
  site: 'claude',
  name: 'extended_thinking',
  description: 'Toggle Claude extended thinking (deep reasoning) on/off',
  domain: 'claude.ai',
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
        const toggles = Array.from(document.querySelectorAll('[role="switch"], button[aria-pressed]'));
        const thinkingToggle = toggles.find(el => {
          const label = (el.getAttribute('aria-label') || el.title || el.closest('label')?.textContent || '').toLowerCase();
          return label.includes('think') || label.includes('extended') || label.includes('reasoning');
        });
        if (!thinkingToggle) return null;
        return thinkingToggle.getAttribute('aria-checked') === 'true' || thinkingToggle.getAttribute('aria-pressed') === 'true';
      })()
    `);

    if (action === 'status') {
      if (current === null) return [{ Feature: 'Extended thinking', Status: 'Toggle not found (may require Opus model)' }];
      return [{ Feature: 'Extended thinking', Status: current ? 'On' : 'Off' }];
    }

    const shouldBeOn = action === 'on';
    if (current === shouldBeOn) return [{ Feature: 'Extended thinking', Status: `Already ${action}` }];

    const toggled = await page.evaluate(`
      (function() {
        const toggles = Array.from(document.querySelectorAll('[role="switch"], button[aria-pressed]'));
        const thinkingToggle = toggles.find(el => {
          const label = (el.getAttribute('aria-label') || el.title || el.closest('label')?.textContent || '').toLowerCase();
          return label.includes('think') || label.includes('extended') || label.includes('reasoning');
        });
        if (thinkingToggle) { thinkingToggle.click(); return true; }
        return false;
      })()
    `);

    return [{ Feature: 'Extended thinking', Status: toggled ? `Turned ${action}` : 'Toggle not found' }];
  },
});
