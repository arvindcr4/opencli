import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const voiceCommand = cli({
  site: 'chatgpt',
  name: 'voice',
  description: 'Start or stop ChatGPT voice mode (Advanced Voice Mode)',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
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
          const voiceBtn = document.querySelector('[data-testid*="voice"], button[aria-label*="voice" i]');
          const isActive = voiceBtn?.getAttribute('aria-pressed') === 'true' || 
                          voiceBtn?.classList.contains('active') ||
                          !!document.querySelector('[class*="voice-active"], [data-voice-active]');
          return isActive ? 'active' : 'inactive';
        })()
      `);
      return [{ Action: 'status', Status: status as string }];
    }

    if (action === 'start') {
      const started = await page.evaluate(`
        (function() {
          // Look for voice mode button
          const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
          const voiceBtn = btns.find(b => {
            const label = (b.getAttribute('aria-label') || b.title || b.getAttribute('data-testid') || '').toLowerCase();
            return label.includes('voice') || label.includes('microphone') || label.includes('speak');
          });
          if (voiceBtn && voiceBtn.getAttribute('aria-pressed') !== 'true') {
            voiceBtn.click();
            return true;
          }
          return false;
        })()
      `);
      return [{ Action: 'start', Status: started ? 'Voice mode started' : 'Voice button not found' }];
    }

    // stop
    const stopped = await page.evaluate(`
      (function() {
        // Find end call / stop voice button
        const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
        const stopBtn = btns.find(b => {
          const label = (b.getAttribute('aria-label') || b.title || b.textContent || '').toLowerCase();
          return label.includes('end') || label.includes('stop') || label.includes('hang up');
        });
        if (stopBtn) { stopBtn.click(); return true; }
        // Try toggling voice button off
        const voiceBtn = btns.find(b => {
          const label = (b.getAttribute('aria-label') || b.title || '').toLowerCase();
          return (label.includes('voice') || label.includes('microphone')) && b.getAttribute('aria-pressed') === 'true';
        });
        if (voiceBtn) { voiceBtn.click(); return true; }
        return false;
      })()
    `);
    return [{ Action: 'stop', Status: stopped ? 'Voice mode stopped' : 'No active voice session found' }];
  },
});
