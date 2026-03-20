import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const workspaceCommand = cli({
  site: 'gemini',
  name: 'workspace',
  description: 'Open Gemini for Google Workspace or navigate to connected Workspace features',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'app', required: false, positional: true, help: 'Workspace app: docs | gmail | sheets | drive | all (default: all)', choices: ['docs', 'gmail', 'sheets', 'drive', 'all'], default: 'all' },
  ],
  columns: ['App', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const app = (kwargs.app as string) || 'all';

    // Navigate to Gemini Workspace integration
    const workspaceUrls: Record<string, string> = {
      docs: 'https://gemini.google.com/app?integrations=docs',
      gmail: 'https://gemini.google.com/app?integrations=gmail',
      sheets: 'https://gemini.google.com/app?integrations=sheets',
      drive: 'https://gemini.google.com/app?integrations=drive',
      all: 'https://gemini.google.com/app',
    };

    await page.goto(workspaceUrls[app] || workspaceUrls.all);
    await page.wait(3);

    // Check for workspace/extension indicators
    const status = await page.evaluate(`
      (function() {
        const workspaceIndicators = Array.from(document.querySelectorAll('[class*="workspace"], [class*="integration"], [aria-label*="Workspace" i]'));
        return workspaceIndicators.length ? 'Workspace features available' : 'Standard Gemini mode';
      })()
    `);

    return [{ App: app, Status: status as string }];
  },
});
