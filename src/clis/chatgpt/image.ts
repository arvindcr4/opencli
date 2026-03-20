import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

async function isGeneratingImage(page: IPage): Promise<boolean> {
  const result = await page.evaluate(`
    (function() {
      if (document.querySelector('[data-testid="stop-button"]')) return true;
      const btns = Array.from(document.querySelectorAll('button'));
      if (btns.some(b => /^stop/i.test((b.textContent || b.getAttribute('aria-label') || '').trim()))) return true;
      return false;
    })()
  `);
  return !!result;
}

export const imageCommand = cli({
  site: 'chatgpt',
  name: 'image',
  description: 'Generate an image with ChatGPT (DALL-E). Returns the image URL.',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  timeoutSeconds: 300,
  args: [
    { name: 'prompt', required: true, positional: true, help: 'Image generation prompt' },
    { name: 'timeout', required: false, help: 'Max seconds to wait (default: 180)', default: '180' },
  ],
  columns: ['Prompt', 'Image URL'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const prompt = kwargs.prompt as string;
    const timeout = parseInt(kwargs.timeout as string, 10) || 180;

    // Count images before sending
    const imagesBefore = await page.evaluate(`
      (function() {
        return Array.from(document.querySelectorAll(
          '[data-message-author-role="assistant"] img, [class*="generated"] img, img[alt*="generated"]'
        )).map(i => i.src).filter(s => s && !s.includes('avatar') && !s.includes('logo'));
      })()
    `) as string[];

    // Send the prompt
    const snapshot = await page.snapshot({ interactive: true });
    const inputRef =
      (snapshot?.nodes as any[])?.find((n: any) => n.role === 'textbox' && n.id?.includes('prompt'))?.ref ??
      (snapshot?.nodes as any[])?.find((n: any) =>
        (n.role === 'textbox' || n.role === 'combobox') &&
        (n.name?.toLowerCase().includes('message') || n.placeholder?.toLowerCase().includes('message'))
      )?.ref;

    if (!inputRef) throw new Error('Could not find ChatGPT input — make sure chatgpt.com is open');

    await page.click(inputRef);
    await page.typeText(inputRef, prompt);
    await page.pressKey('Return');

    // Wait for image to appear
    const deadline = Date.now() + timeout * 1000;
    let imageUrl = '';

    while (Date.now() < deadline) {
      await page.wait(3);

      // Check if still generating
      const stillGenerating = await isGeneratingImage(page);

      const imagesNow = await page.evaluate(`
        (function() {
          return Array.from(document.querySelectorAll(
            '[data-message-author-role="assistant"] img, [class*="generated"] img, img[alt*="generated"], img[alt*="DALL"], img[src*="oaiusercontent"]'
          )).map(i => i.src).filter(s => s && !s.includes('avatar') && !s.includes('logo'));
        })()
      `) as string[];

      const newImages = imagesNow.filter(url => !imagesBefore.includes(url));
      if (newImages.length > 0 && !stillGenerating) {
        imageUrl = newImages[0];
        break;
      }

      if (!stillGenerating && Date.now() > deadline - timeout * 500) {
        // Check for any new images even if stop button gone
        if (newImages.length > 0) {
          imageUrl = newImages[0];
          break;
        }
      }
    }

    if (!imageUrl) {
      return [{ Prompt: prompt, 'Image URL': `Timeout after ${timeout}s — check chatgpt.com` }];
    }
    return [{ Prompt: prompt, 'Image URL': imageUrl }];
  },
});
