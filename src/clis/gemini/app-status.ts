/**
 * Gemini MacOS Desktop App — status.
 *
 * Checks whether the Google Gemini MacOS app is running and returns basic info
 * about the focused window.
 */

import { cli, Strategy } from '../../registry.js';
import {
  isGeminiRunning,
  activateGemini,
  getVisibleGeminiText,
} from './desktop.js';

export const appStatusCommand = cli({
  site: 'gemini',
  name: 'app-status',
  description: 'Check whether the Google Gemini MacOS Desktop App is running',
  domain: 'localhost',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [],
  columns: ['Status', 'Windows', 'VisibleTextPreview'],
  func: async () => {
    if (!isGeminiRunning()) {
      return [{
        Status: 'Not running',
        Windows: '0',
        VisibleTextPreview: '',
      }];
    }

    activateGemini();
    const text = getVisibleGeminiText();
    return [{
      Status: 'Running',
      Windows: '1',
      VisibleTextPreview: text.slice(-1).join('').slice(0, 200),
    }];
  },
});
