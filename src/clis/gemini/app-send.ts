/**
 * Gemini MacOS Desktop App — send.
 *
 * Copies the message to the clipboard, activates the Gemini app, and pastes
 * the message followed by Return to submit.
 */

import { cli, Strategy } from '../../registry.js';
import {
  activateGemini,
  pasteAndSubmitToGemini,
} from './desktop.js';

export const appSendCommand = cli({
  site: 'gemini',
  name: 'app-send',
  description: 'Send a message to the active Google Gemini MacOS Desktop App window',
  domain: 'localhost',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'text', required: true, positional: true, help: 'Message to send' },
  ],
  columns: ['Status'],
  func: async (_page, kwargs) => {
    const text = kwargs.text as string;
    if (!text) {
      return [{ Status: 'Error: no text provided' }];
    }

    try {
      activateGemini();
      pasteAndSubmitToGemini(text);
      return [{ Status: 'Sent' }];
    } catch (err: any) {
      return [{ Status: `Error: ${err.message}` }];
    }
  },
});
