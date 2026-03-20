import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const auroraCommand = cli({
  site: 'grok',
  name: 'aurora',
  description: 'Generate an image using Grok Aurora (xAI image generation) with detailed controls',
  domain: 'grok.com',
  strategy: Strategy.COOKIE,
  browser: true,
  timeoutSeconds: 300,
  args: [
    { name: 'prompt', required: true, positional: true, help: 'Detailed image generation prompt' },
    { name: 'style', required: false, help: 'Style hint: photorealistic | artistic | anime | abstract', choices: ['photorealistic', 'artistic', 'anime', 'abstract'] },
    { name: 'timeout', required: false, help: 'Max seconds to wait (default: 120)', default: '120' },
  ],
  columns: ['Status', 'Result'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const style = kwargs.style as string | undefined;
    const basePrompt = kwargs.prompt as string;
    const timeout = parseInt(kwargs.timeout as string, 10) || 120;

    const fullPrompt = style ? `${basePrompt} --style ${style}` : basePrompt;
    const promptJson = JSON.stringify(fullPrompt);

    await page.goto('https://grok.com');
    await page.wait(3);

    // Enable image mode
    await page.evaluate(`
      (function() {
        const imageModeBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
          const label = (b.getAttribute('aria-label') || b.textContent || '').toLowerCase();
          return label.includes('image') || label.includes('aurora') || label.includes('create image');
        });
        if (imageModeBtn) imageModeBtn.click();
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
      return 'enter';
    })()`);

    if (sendResult === 'no_textarea') return [{ Status: 'Error', Result: 'No textarea found' }];

    const deadline = Date.now() + timeout * 1000;
    while (Date.now() < deadline) {
      await page.wait(5);
      const imgResult = await page.evaluate(`
        (function() {
          const bubbles = Array.from(document.querySelectorAll('[data-testid="message-bubble"], div.message-bubble'));
          const last = bubbles[bubbles.length - 1];
          if (!last) return null;
          const img = last.querySelector('img');
          if (img && img.src) return { type: 'image', src: img.src };
          const text = (last.innerText || '').trim();
          if (text && text.length > 10) return { type: 'text', src: text.slice(0, 200) };
          return null;
        })()
      `) as { type: string; src: string } | null;

      if (imgResult) {
        if (imgResult.type === 'image') {
          return [{ Status: 'Generated', Result: imgResult.src.startsWith('blob:') ? 'Image visible in browser' : imgResult.src }];
        }
        if (imgResult.type === 'text' && imgResult.src.length > 50) {
          return [{ Status: 'Response', Result: imgResult.src }];
        }
      }
    }

    return [{ Status: 'Timeout', Result: `No image after ${timeout}s` }];
  },
});
