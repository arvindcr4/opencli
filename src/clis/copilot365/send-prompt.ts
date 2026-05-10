import { readFileSync } from 'node:fs';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { COPILOT365_URL, copilotDomSend, isCopilot365Url } from './_lib/shared.js';

export const sendPromptCommand = cli({
  site: 'copilot365',
  name: 'send-prompt',
  description: 'Send a prompt loaded from a file (alias of `send --file`)',
  domain: 'm365.cloud.microsoft',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'file', type: 'string', required: true, help: 'File containing the prompt to send' },
  ],
  columns: ['Status'],
  func: async (page: IPage, kwargs: Record<string, any>) => {
    const filePath = kwargs.file as string;
    const text = readFileSync(filePath, 'utf8').trim();
    if (!text) throw new Error('Prompt file is empty: ' + filePath);

    const currentUrl = await page.evaluate(`() => window.location.href`);
    if (!isCopilot365Url(currentUrl)) {
      await page.goto(COPILOT365_URL);
      await page.wait(5);
    }

    const result = await copilotDomSend(page, text);
    if (!result.ok) return [{ Status: '[SEND FAILED] ' + JSON.stringify(result) }];
    return [{ Status: 'Sent prompt from ' + filePath + ' (' + result.msg + ')' }];
  },
});
