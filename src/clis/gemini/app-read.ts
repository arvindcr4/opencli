/**
 * Gemini MacOS Desktop App — read.
 *
 * Reads the visible chat content from the focused Gemini window using the
 * macOS Accessibility tree.
 */

import { cli, Strategy } from '../../registry.js';
import {
  activateGemini,
  getVisibleGeminiText,
} from './desktop.js';

export const appReadCommand = cli({
  site: 'gemini',
  name: 'app-read',
  description: 'Read the latest visible chat content from the Gemini MacOS Desktop App',
  domain: 'localhost',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [],
  columns: ['Index', 'Text'],
  func: async () => {
    if (getVisibleGeminiText().length === 0) {
      // The app is probably not running; activate it as a best-effort
      activateGemini();
    }
    const lines = getVisibleGeminiText();
    if (lines.length === 0) {
      return [{ Index: 0, Text: '(no readable text — is Gemini running and focused?)' }];
    }
    return lines.map((t, i) => ({ Index: i + 1, Text: t }));
  },
});
