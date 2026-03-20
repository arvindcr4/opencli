import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';

export const thinkingCommand = cli({
  site: 'gemini',
  name: 'thinking',
  description: 'Switch Gemini to Flash Thinking (deep reasoning) mode',
  domain: 'gemini.google.com',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'action', required: false, positional: true, help: 'Action: on | off | status (default: on)', choices: ['on', 'off', 'status'], default: 'on' },
  ],
  columns: ['Model', 'Status'],
  func: async (page: IPage | null, kwargs: any) => {
    if (!page) throw new Error('Browser page not available');
    const action = (kwargs.action as string) || 'on';

    if (action === 'on') {
      await page.goto('https://gemini.google.com/app?model=gemini-2.0-flash-thinking-exp');
      await page.wait(3);
      const title = await page.evaluate(`document.title`) as string;
      return [{ Model: 'Flash Thinking', Status: title.includes('Gemini') ? 'Active' : 'Navigated' }];
    }

    if (action === 'off') {
      await page.goto('https://gemini.google.com/app');
      await page.wait(2);
      return [{ Model: 'Default', Status: 'Thinking mode off' }];
    }

    // status
    const url = await page.evaluate(`location.href`) as string;
    const isThinking = url.includes('thinking') || url.includes('think');
    return [{ Model: isThinking ? 'Flash Thinking' : 'Default', Status: isThinking ? 'On' : 'Off' }];
  },
});
