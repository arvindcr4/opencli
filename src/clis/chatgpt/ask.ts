import { execSync } from 'node:child_process';
import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { getVisibleChatMessages, getVisibleChatMessagesFromPage } from './ax.js';
import {
  CHATGPT_MODEL_CHOICES,
  activateChatGpt,
  pasteAndSubmitToChatGpt,
  switchChatGptModel,
} from './shared.js';

export const askCommand = cli({
  site: 'chatgpt',
  name: 'ask',
  description: 'Send a prompt and wait for the AI response (send + wait + read)',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: process.platform !== 'darwin',
  args: [
    { name: 'text', required: true, positional: true, help: 'Prompt to send' },
    { name: 'timeout', required: false, help: 'Max seconds to wait for response (default: 30)', default: '30' },
    {
      name: 'model',
      required: false,
      help: 'Model/mode to choose before sending (e.g. pro, thinking, instant, auto)',
      choices: [...CHATGPT_MODEL_CHOICES],
    },
  ],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null, kwargs: any) => {
    const text = kwargs.text as string;
    const timeout = parseInt(kwargs.timeout as string, 10) || 30;
    const desiredModel = kwargs.model as string | undefined;

    if (process.platform === 'darwin') {
      if (desiredModel) {
        switchChatGptModel(desiredModel);
      } else {
        activateChatGpt();
      }

      const messagesBefore = getVisibleChatMessages();
      pasteAndSubmitToChatGpt(text);

      const pollInterval = 1;
      const maxPolls = Math.ceil(timeout / pollInterval);
      let response = '';
      for (let i = 0; i < maxPolls; i++) {
        execSync(`sleep ${pollInterval}`);
        execSync("osascript -e 'tell application \"ChatGPT\" to activate'");
        execSync("osascript -e 'delay 0.2'");
        const messagesNow = getVisibleChatMessages();
        if (messagesNow.length <= messagesBefore.length) continue;
        const candidate = [...messagesNow.slice(messagesBefore.length)].reverse().find((m) => m !== text);
        if (candidate) {
          response = candidate;
          break;
        }
      }
      if (!response) {
        return [
          { Role: 'User', Text: text },
          { Role: 'System', Text: `No response within ${timeout}s. ChatGPT may still be generating.` },
        ];
      }
      return [{ Role: 'User', Text: text }, { Role: 'Assistant', Text: response }];
    }

    if (desiredModel) {
      throw new Error('--model is currently only supported by the macOS ChatGPT desktop app');
    }

    if (!page) throw new Error('Browser page not available');

    const messagesBefore = await getVisibleChatMessagesFromPage(page);

    const snapshot = await page.snapshot({ interactive: true });
    const inputRef = snapshot?.nodes?.find((n: any) => n.role === 'textbox' && n.id?.includes('prompt'))?.ref
      ?? snapshot?.nodes?.find((n: any) =>
        (n.role === 'textbox' || n.role === 'combobox') &&
        (n.name?.toLowerCase().includes('message') || n.placeholder?.toLowerCase().includes('message') || n.name?.includes('prompt'))
      )?.ref;
    if (!inputRef) throw new Error('Could not find ChatGPT input field — make sure chatgpt.com is open');
    await page.click(inputRef);
    await page.typeText(inputRef, text);
    await page.pressKey('Return');

    const deadline = Date.now() + timeout * 1000;
    let response = '';
    while (Date.now() < deadline) {
      await page.wait(2);
      const messagesNow = await getVisibleChatMessagesFromPage(page);
      if (messagesNow.length > messagesBefore.length) {
        const candidate = [...messagesNow.slice(messagesBefore.length)].reverse().find((m) => m !== text);
        if (candidate) {
          let prev = candidate;
          for (let i = 0; i < 8; i++) {
            await page.wait(1);
            const latest = await getVisibleChatMessagesFromPage(page);
            const cur = [...latest.slice(messagesBefore.length)].reverse().find((m) => m !== text) || prev;
            if (cur === prev && cur.length > 1) break;
            prev = cur;
          }
          response = prev;
          break;
        }
      }
    }

    if (!response) {
      return [
        { Role: 'User', Text: text },
        { Role: 'System', Text: `No response within ${timeout}s. ChatGPT may still be generating.` },
      ];
    }
    return [{ Role: 'User', Text: text }, { Role: 'Assistant', Text: response }];
  },
});
