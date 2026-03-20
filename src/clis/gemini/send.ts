import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const sendCommand = cli({
  site: 'gemini',
  name: 'send',
  description: 'Send a message to Gemini without waiting for the response',
  domain: 'gemini.google.com',
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
    const inputRef =
      nodes.find((n: any) => n.role === 'textbox' && (n.name?.includes('Enter') || n.placeholder?.includes('Enter')))?.ref ??
      nodes.find((n: any) => n.role === 'textbox' || n.role === 'combobox')?.ref;

    if (!inputRef) return [{ Status: 'Could not find Gemini input field' }];

    await page.click(inputRef);
    await page.typeText(inputRef, prompt);
    await page.wait(1);

    const sent = await page.evaluate(`
      (function() {
        const btn = document.querySelector('button[aria-label*="Send"], button[data-mat-icon-name*="send"]');
        const sendBtn = btn?.closest ? (btn.closest('button') || btn) : btn;
        if (sendBtn) { sendBtn.click(); return true; }
        return false;
      })()
    `);
    if (!sent) await page.pressKey('Return');

    return [{ Status: 'Sent' }];
  },
});
