import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import {
  CHATGPT_MODEL_CHOICES,
  getActiveChatGptModel,
  switchChatGptModel,
} from './shared.js';

export const modelCommand = cli({
  site: 'chatgpt',
  name: 'model',
  description: 'Get or switch the active model in ChatGPT Desktop',
  domain: 'localhost',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    {
      name: 'model-name',
      required: false,
      positional: true,
      help: 'Model to switch to (e.g. pro, thinking, instant, auto)',
      choices: [...CHATGPT_MODEL_CHOICES],
    },
  ],
  columns: ['Status', 'Model'],
  func: async (_page: IPage | null, kwargs: any) => {
    const desiredModel = kwargs['model-name'] as string | undefined;

    try {
      if (!desiredModel) {
        return [{ Status: 'Active', Model: getActiveChatGptModel() }];
      }

      const result = switchChatGptModel(desiredModel);
      return [
        {
          Status: result.status,
          Model: result.active ?? result.matched ?? desiredModel,
        },
      ];
    } catch (err: any) {
      return [{ Status: 'Error', Model: err.message }];
    }
  },
});
