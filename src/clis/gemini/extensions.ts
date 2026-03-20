import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const extensionsCommand = cli({
  site: 'gemini',
  name: 'extensions',
  description: 'List or toggle Gemini extensions (Google Workspace, YouTube, etc.)',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'action', required: false, positional: true, help: 'Action: list | enable | disable (default: list)', choices: ['list', 'enable', 'disable'], default: 'list' },
    { name: 'name', required: false, help: 'Extension name to enable/disable' },
  ],
  columns: ['Extension', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const action = (kwargs.action as string) || 'list';
    const extName = (kwargs.name as string | undefined)?.toLowerCase() || '';

    await page.goto('https://gemini.google.com/extensions');
    await page.wait(3);

    if (action === 'list') {
      const extensions = await page.evaluate(`
        (function() {
          const items = Array.from(document.querySelectorAll('[class*="extension"], [class*="Extension"], mat-list-item, .extension-item'));
          return JSON.stringify(items.map(el => ({
            name: (el.querySelector('[class*="name"], h3, h2, strong') || el).textContent?.trim().slice(0, 60) || 'Unknown',
            enabled: !!(el.querySelector('[aria-checked="true"], .enabled, input[checked]'))
          })));
        })()
      `);

      let extList: Array<{ name: string; enabled: boolean }> = [];
      try { extList = JSON.parse(extensions as string); } catch { /* ignore */ }
      if (!extList.length) return [{ Extension: 'No extensions found', Status: '' }];
      return extList.map(e => ({ Extension: e.name, Status: e.enabled ? 'Enabled' : 'Disabled' }));
    }

    if (!extName) return [{ Extension: '', Status: 'Extension name required for enable/disable' }];

    const toggled = await page.evaluate(`
      (function(name, targetAction) {
        const items = Array.from(document.querySelectorAll('[class*="extension"], mat-list-item'));
        const item = items.find(el => (el.textContent || '').toLowerCase().includes(name));
        if (!item) return 'not_found';
        const toggle = item.querySelector('mat-slide-toggle, [role="switch"], input[type="checkbox"]');
        if (!toggle) return 'no_toggle';
        const isEnabled = toggle.getAttribute('aria-checked') === 'true' || toggle.checked;
        if (targetAction === 'enable' && !isEnabled) { toggle.click(); return 'enabled'; }
        if (targetAction === 'disable' && isEnabled) { toggle.click(); return 'disabled'; }
        return 'already_' + (isEnabled ? 'enabled' : 'disabled');
      })(${JSON.stringify(extName)}, ${JSON.stringify(action)})
    `);

    return [{ Extension: extName, Status: String(toggled) }];
  },
});
