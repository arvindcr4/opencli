import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { getLastGeminiResponse, isGeminiGenerating } from './ax.js';

export const imageCommand = cli({
  site: 'gemini',
  name: 'image',
  description: 'Generate an image with Gemini Imagen or analyze an image URL',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  timeoutSeconds: 300,
  args: [
    { name: 'prompt', required: true, positional: true, help: 'Image generation prompt or image analysis request' },
    { name: 'timeout', required: false, help: 'Max seconds to wait (default: 120)', default: '120' },
  ],
  columns: ['Status', 'Response'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const prompt = kwargs.prompt as string;
    const timeout = parseInt(kwargs.timeout as string, 10) || 120;

    await page.goto('https://gemini.google.com/app');
    await page.wait(3);

    const responseBefore = await getLastGeminiResponse(page);

    const snapshot = await page.snapshot({ interactive: true });
    const nodes = (snapshot?.nodes as any[]) ?? [];
    const inputRef = nodes.find((n: any) => n.role === 'textbox' || n.role === 'combobox')?.ref;
    if (!inputRef) return [{ Status: 'Error', Response: 'Could not find input field' }];

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

    const deadline = Date.now() + timeout * 1000;
    let prev = '';
    let stableCount = 0;

    while (Date.now() < deadline) {
      await page.wait(3);
      if (await isGeminiGenerating(page)) { stableCount = 0; continue; }
      const cur = await getLastGeminiResponse(page);
      if (cur && cur !== responseBefore && cur.length > 5) {
        if (cur === prev) {
          stableCount++;
          if (stableCount >= 2) return [{ Status: 'Done', Response: cur }];
        } else { stableCount = 0; prev = cur; }
      }
    }

    // Check for generated image
    const hasImage = await page.evaluate(`
      !!(document.querySelector('img[src*="generativelanguage"], img[alt*="generated"], img[class*="image-response"]'))
    `);
    if (hasImage) return [{ Status: 'Image generated', Response: 'Image visible in browser' }];
    return [{ Status: 'Timeout', Response: prev || 'No response' }];
  },
});
