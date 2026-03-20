import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const clearCommand = cli({
  site: 'chatgpt',
  name: 'clear',
  description: 'Clear the chatgpt input field',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [],
  columns: ['Status'],
  func: async (page: IPage | null) => {
    if (!page) throw new Error('Browser page not available');

    const cleared = await page.evaluate(`
      (function() {
        const inputs = Array.from(document.querySelectorAll('textarea, [contenteditable="true"][role="textbox"]'));
        const main = inputs.find(el => el.getBoundingClientRect().height > 20);
        if (!main) return false;
        main.focus();
        document.execCommand('selectAll');
        document.execCommand('delete');
        main.textContent = '';
        main.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()
    `);

    return [{ Status: cleared ? 'Input cleared' : 'No input field found' }];
  },
});
