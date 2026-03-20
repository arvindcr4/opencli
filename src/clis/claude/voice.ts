import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const voiceCommand = cli({
  site: 'claude',
  name: 'voice',
  description: 'Toggle Claude voice mode (if available in browser)',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'action', required: false, positional: true, help: 'Action: start | stop | status (default: status)', choices: ['start', 'stop', 'status'], default: 'status' },
  ],
  columns: ['Action', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const action = (kwargs.action as string) || 'status';

    if (action === 'status') {
      const status = await page.evaluate(`
        (function() {
          const voiceActive = !!(
            document.querySelector('[data-testid*="voice"][aria-pressed="true"]') ||
            document.querySelector('[class*="voice-active"]')
          );
          return voiceActive ? 'active' : 'inactive';
        })()
      `);
      return [{ Action: 'status', Status: status as string }];
    }

    if (action === 'start') {
      const started = await page.evaluate(`
        (function() {
          const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
          const voiceBtn = btns.find(b => {
            const label = (b.getAttribute('aria-label') || b.title || '').toLowerCase();
            return label.includes('voice') || label.includes('speak') || label.includes('microphone');
          });
          if (voiceBtn) { voiceBtn.click(); return true; }
          return false;
        })()
      `);
      return [{ Action: 'start', Status: started ? 'Voice mode started' : 'Voice button not found on claude.ai' }];
    }

    const stopped = await page.evaluate(`
      (function() {
        const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
        const stopBtn = btns.find(b => {
          const label = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
          return (label.includes('voice') && b.getAttribute('aria-pressed') === 'true') || label.includes('end voice');
        });
        if (stopBtn) { stopBtn.click(); return true; }
        return false;
      })()
    `);
    return [{ Action: 'stop', Status: stopped ? 'Voice mode stopped' : 'No active voice session found' }];
  },
});
