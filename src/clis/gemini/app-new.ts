/**
 * Gemini MacOS Desktop App — new conversation.
 *
 * Activates the Gemini app and presses Cmd+N to start a new conversation.
 */

import { cli, Strategy } from '../../registry.js';
import { newGeminiConversation } from './desktop.js';

export const appNewCommand = cli({
  site: 'gemini',
  name: 'app-new',
  description: 'Start a new conversation in the Google Gemini MacOS Desktop App',
  domain: 'localhost',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [],
  columns: ['Status'],
  func: async () => {
    try {
      newGeminiConversation();
      return [{ Status: 'New conversation started' }];
    } catch (err: any) {
      return [{ Status: `Error: ${err.message}` }];
    }
  },
});
