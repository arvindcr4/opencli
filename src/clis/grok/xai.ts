import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const xaiCommand = cli({
  site: 'grok',
  name: 'xai',
  description: 'Get xAI / Grok account info, subscription status, and usage',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'action', required: false, positional: true, help: 'Action: info | usage | subscription (default: info)', choices: ['info', 'usage', 'subscription'], default: 'info' },
  ],
  columns: ['Key', 'Value'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const action = (kwargs.action as string) || 'info';

    await page.goto('https://grok.com/settings');
    await page.wait(3);

    const info = await page.evaluate(`
      (function() {
        const results = {};
        // Get all settings/info from the page
        const sections = Array.from(document.querySelectorAll('[class*="setting"], [class*="profile"], [class*="account"], section, dl, .info-row'));
        for (const section of sections) {
          const labels = Array.from(section.querySelectorAll('dt, label, [class*="label"], th'));
          const values = Array.from(section.querySelectorAll('dd, [class*="value"], td, span:not([class*="label"])'));
          labels.forEach((label, i) => {
            const key = (label.textContent || '').trim();
            const val = values[i] ? (values[i].textContent || '').trim() : '';
            if (key && val) results[key.slice(0, 40)] = val.slice(0, 100);
          });
        }
        // Fallback: scrape main text
        if (!Object.keys(results).length) {
          const main = document.querySelector('main, [role="main"]');
          const text = (main?.textContent || '').trim().slice(0, 500);
          return JSON.stringify({ 'Page Content': text });
        }
        return JSON.stringify(results);
      })()
    `);

    let result: Record<string, string> = {};
    try { result = JSON.parse(info as string); } catch { /* ignore */ }
    const entries = Object.entries(result);
    if (!entries.length) return [{ Key: 'Status', Value: 'No account info found on settings page' }];
    return entries.map(([k, v]) => ({ Key: k, Value: v }));
  },
});
