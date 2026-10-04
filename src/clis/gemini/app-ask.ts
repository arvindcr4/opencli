/**
 * Gemini MacOS Desktop App — ask.
 *
 * Sends a message, waits for the response, and returns the last visible
 * chat content. Useful for interactive "ask Gemini and get an answer" flows.
 *
 * IMPORTANT: This relies on the Accessibility tree to read the response. It
 * does NOT have a reliable "response finished" signal — it just waits for
 * the visible text to stabilise (no change for `--stable` polls).
 */

import { cli, Strategy } from '../../registry.js';
import {
  activateGemini,
  pasteAndSubmitToGemini,
  getVisibleGeminiText,
} from './desktop.js';

export const appAskCommand = cli({
  site: 'gemini',
  name: 'app-ask',
  access: 'write',
  description: 'Send a prompt to the Gemini MacOS Desktop App and read back the response',
  domain: 'localhost',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'text', required: true, positional: true, help: 'Prompt to send' },
    { name: 'timeout', type: 'int', default: 60, help: 'Max seconds to wait for the response' },
  ],
  columns: ['Role', 'Text'],
  func: async (kwargs: Record<string, any>) => {
    const text = kwargs.text as string;
    const timeoutMs = ((kwargs.timeout as number) || 60) * 1000;
    const beforeText = getVisibleGeminiText().join('\n');

    try {
      activateGemini();
      pasteAndSubmitToGemini(text);
    } catch (err: any) {
      return [
        { Role: 'User', Text: text },
        { Role: 'System', Text: `[SEND FAILED] ${err.message}` },
      ];
    }

    // Poll for response: wait until the visible text changes and then stays
    // stable for 2 consecutive polls (~2 seconds).
    const deadline = Date.now() + timeoutMs;
    let lastText = beforeText;
    let stableCount = 0;
    const stableThreshold = 2;

    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 1000));
      const current = getVisibleGeminiText().join('\n');
      if (current.length > beforeText.length && current !== lastText) {
        lastText = current;
        stableCount = 0;
        continue;
      }
      if (current === lastText && current.length > beforeText.length) {
        stableCount++;
        if (stableCount >= stableThreshold) break;
      } else if (current !== lastText) {
        lastText = current;
      }
    }

    const responseLines = lastText.split('\n');
    // Skip lines that were in `beforeText`
    const beforeLines = beforeText.split('\n');
    const newLines = responseLines.filter(l => !beforeLines.includes(l));
    const response = newLines.length > 0 ? newLines.join('\n') : lastText;

    return [
      { Role: 'User', Text: text },
      { Role: 'Gemini', Text: response },
    ];
  },
});
