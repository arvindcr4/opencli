import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const imageCommand = cli({
  site: 'grok',
  name: 'image',
  description: 'Generate an image using Grok Aurora',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  timeoutSeconds: 300,
  args: [
    { name: 'prompt', required: true, positional: true, help: 'Image generation prompt' },
    { name: 'timeout', required: false, help: 'Max seconds to wait (default: 120)', default: '120' },
  ],
  columns: ['Status', 'Response'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const prompt = kwargs.prompt as string;
    const timeout = parseInt(kwargs.timeout as string, 10) || 120;
    const promptJson = JSON.stringify(prompt);

    await page.goto('https://grok.com');
    await page.wait(3);

    // Enable image generation mode if available
    await page.evaluate(`
      (function() {
        const imageBtns = Array.from(document.querySelectorAll('button, [role="button"]'));
        const imageBtn = imageBtns.find(b => {
          const label = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
          return label.includes('image') || label.includes('aurora') || label.includes('generate');
        });
        if (imageBtn) imageBtn.click();
      })()
    `);

    await page.wait(1);

    const sendResult = await page.evaluate(`(async () => {
      const box = document.querySelector('textarea');
      if (!box) return 'no_textarea';
      box.focus(); box.value = '';
      document.execCommand('selectAll');
      document.execCommand('insertText', false, ${promptJson});
      await new Promise(r => setTimeout(r, 1000));
      const sub = [...document.querySelectorAll('button[type="submit"]')].find(b => !b.disabled);
      if (sub) { sub.click(); return 'sent'; }
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      return 'enter_pressed';
    })()`);

    if (sendResult === 'no_textarea') return [{ Status: 'Error', Response: 'No textarea found' }];

    const deadline = Date.now() + timeout * 1000;
    while (Date.now() < deadline) {
      await page.wait(4);
      const hasImage = await page.evaluate(`
        (function() {
          const imgs = Array.from(document.querySelectorAll('img'));
          const generated = imgs.find(img => {
            const src = img.src || '';
            return src.includes('blob:') || src.includes('data:') || src.includes('generated') || img.alt?.includes('generated');
          });
          if (generated) return generated.src;
          // Check if there's a new response bubble with image
          const bubbles = document.querySelectorAll('[data-testid="message-bubble"], div.message-bubble');
          const last = bubbles[bubbles.length - 1];
          const img = last?.querySelector('img');
          if (img) return img.src || 'image_found';
          return null;
        })()
      `) as string | null;

      if (hasImage) return [{ Status: 'Generated', Response: hasImage.startsWith('blob:') ? 'Image visible in browser' : hasImage }];
    }
    return [{ Status: 'Timeout', Response: `No image generated after ${timeout}s` }];
  },
});
