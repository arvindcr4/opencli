import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import {
  CHATGPT_MODEL_CHOICES,
  activateChatGpt,
  pasteAndSubmitToChatGpt,
  switchChatGptModel,
} from './shared.js';

export const sendCommand = cli({
  site: 'chatgpt',
  name: 'send',
  description: 'Send a message to ChatGPT (desktop app on macOS, browser on Linux)',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: process.platform !== 'darwin',
  args: [
    { name: 'text', required: true, positional: true, help: 'Message to send' },
    {
      name: 'model',
      required: false,
      help: 'Model/mode to choose before sending (e.g. pro, thinking, instant, auto)',
      choices: [...CHATGPT_MODEL_CHOICES],
    },
  ],
  columns: ['Status'],
  func: async (page: IPage | null, kwargs: any) => {
    const text = kwargs.text as string;
    const desiredModel = kwargs.model as string | undefined;

    try {
      if (process.platform === 'darwin') {
        if (desiredModel) {
          switchChatGptModel(desiredModel);
        } else {
          activateChatGpt();
        }

        pasteAndSubmitToChatGpt(text);
      } else {
        if (desiredModel) {
          throw new Error('--model is currently only supported by the macOS ChatGPT desktop app');
        }

        if (!page) throw new Error('Browser page not available');
        const snapshot = await page.snapshot({ interactive: true });
        const inputRef = snapshot?.nodes?.find((n: any) =>
          (n.role === 'textbox' || n.role === 'combobox') &&
          (n.name?.toLowerCase().includes('message') || n.placeholder?.toLowerCase().includes('message'))
        )?.ref;
        if (!inputRef) throw new Error('Could not find ChatGPT input field — make sure chatgpt.com is open');
        await page.click(inputRef);
        await page.typeText(inputRef, text);
        await page.pressKey('Return');
      }
      return [{ Status: 'Success' }];
    } catch (err: any) {
      return [{ Status: 'Error: ' + err.message }];
    }
  },
});
