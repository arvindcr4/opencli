import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const voiceCommand = cli({
  site: 'gemini',
  name: 'voice',
  description: 'Toggle Gemini voice / audio input mode',
  domain: 'gemini.google.com',
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
          const micBtn = document.querySelector('button[aria-label*="microphone" i], button[aria-label*="voice" i], mat-icon-button[aria-label*="microphone" i]');
          const isActive = micBtn?.getAttribute('aria-pressed') === 'true' || micBtn?.getAttribute('aria-checked') === 'true';
          return isActive ? 'active' : (micBtn ? 'available' : 'not_found');
        })()
      `);
      return [{ Action: 'status', Status: status as string }];
    }

    if (action === 'start') {
      const started = await page.evaluate(`
        (function() {
          const btns = Array.from(document.querySelectorAll('button, mat-icon-button, [role="button"]'));
          const micBtn = btns.find(b => {
            const label = (b.getAttribute('aria-label') || b.title || '').toLowerCase();
            return label.includes('microphone') || label.includes('voice') || label.includes('speak');
          });
          if (micBtn) { micBtn.click(); return true; }
          return false;
        })()
      `);
      return [{ Action: 'start', Status: started ? 'Voice/microphone started' : 'Microphone button not found' }];
    }

    const stopped = await page.evaluate(`
      (function() {
        const btns = Array.from(document.querySelectorAll('button, mat-icon-button'));
        const stopBtn = btns.find(b => {
          const label = (b.getAttribute('aria-label') || b.title || '').toLowerCase();
          return label.includes('stop') || label.includes('end') || (label.includes('microphone') && b.getAttribute('aria-pressed') === 'true');
        });
        if (stopBtn) { stopBtn.click(); return true; }
        return false;
      })()
    `);
    return [{ Action: 'stop', Status: stopped ? 'Voice stopped' : 'No active voice session' }];
  },
});
