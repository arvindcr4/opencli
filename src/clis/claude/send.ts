import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const sendCommand = cli({
  site: 'claude',
  name: 'send',
  description: 'Send a message to Claude without waiting for the response',
  domain: 'claude.ai',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'prompt', required: true, positional: true, help: 'Message to send' },
  ],
  columns: ['Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const prompt = kwargs.prompt as string;

    const snapshot = await page.snapshot({ interactive: true });
    const nodes = (snapshot?.nodes as any[]) ?? [];
    const inputRef = nodes.find((n: any) =>
      n.role === 'textbox' || (n.role === 'combobox' && !n.name?.toLowerCase().includes('model'))
    )?.ref;

    if (!inputRef) return [{ Status: 'Could not find Claude input field' }];

    await page.click(inputRef);
    await page.typeText(inputRef, prompt);
    await page.wait(1);

    const sent = await page.evaluate(`
      (function() {
        const btn = document.querySelector('button[aria-label*="Send"], button[data-testid*="send"], button[type="submit"]');
        if (btn && !btn.disabled) { btn.click(); return true; }
        return false;
      })()
    `);
    if (!sent) await page.pressKey('Return');

    return [{ Status: 'Sent' }];
  },
});
