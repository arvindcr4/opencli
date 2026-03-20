import { cli, Strategy } from '../../registry.js';
import { getVisibleChatMessagesFromPage } from './ax.js';
import type { IPage } from '../../types.js';

/**
 * Select a ChatGPT model/mode via the model selector dropdown.
 * Uses CDP mouse events — JS synthetic events don't trigger Radix UI dropdowns.
 *
 * Modes: 'instant' | 'thinking' | 'pro'
 * 'pro' maps to "Extended Pro" (o3-pro / research-grade intelligence).
 */
async function selectChatGPTMode(bridge: any, mode: string = 'pro'): Promise<void> {
  const btnResult = await bridge.send('Runtime.evaluate', {
    expression: `(function() {
      const btn = document.querySelector('[data-testid="model-switcher-dropdown-button"]');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    })()`,
    returnByValue: true,
  });
  const btnPos = JSON.parse(btnResult?.result?.value || 'null');
  if (!btnPos) throw new Error('Could not find model selector button');

  // Open dropdown with real mouse event (synthetic clicks don't trigger Radix UI)
  await bridge.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btnPos.x, y: btnPos.y });
  await bridge.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: btnPos.x, y: btnPos.y, button: 'left', clickCount: 1 });
  await bridge.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btnPos.x, y: btnPos.y, button: 'left', clickCount: 1 });
  await new Promise((r) => setTimeout(r, 600));

  // Menu item y-offsets relative to button center (measured empirically)
  const yOffsets: Record<string, number> = { instant: 86, thinking: 137, pro: 188, configure: 240 };
  const itemX = btnPos.x + 55;
  const itemY = btnPos.y + (yOffsets[mode] ?? 188);

  await bridge.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: itemX, y: itemY });
  await new Promise((r) => setTimeout(r, 100));
  await bridge.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: itemX, y: itemY, button: 'left', clickCount: 1 });
  await bridge.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: itemX, y: itemY, button: 'left', clickCount: 1 });
  await new Promise((r) => setTimeout(r, 500));
}

/**
 * Attach a local file to the ChatGPT composer via CDP DOM.setFileInputFiles.
 */
async function attachFile(bridge: any, filePath: string): Promise<void> {
  await bridge.send('DOM.enable');
  const doc = await bridge.send('DOM.getDocument');
  const fileInput = await bridge.send('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector: '#upload-files',
  });
  if (!fileInput?.nodeId) throw new Error('Could not find file input #upload-files');
  await bridge.send('DOM.setFileInputFiles', { nodeId: fileInput.nodeId, files: [filePath] });
  await new Promise((r) => setTimeout(r, 1500));
}

export const promodeCommand = cli({
  site: 'chatgpt',
  name: 'promode',
  description: 'Ask ChatGPT in Pro mode (Extended Pro / o3-pro with extended thinking)',
  domain: 'chatgpt.com',
  strategy: Strategy.PUBLIC,
  browser: true,
  timeoutSeconds: 600,
  args: [
    { name: 'text', required: true, positional: true, help: 'Question or task' },
    { name: 'timeout', required: false, help: 'Max seconds to wait (default: 300)', default: '300' },
    { name: 'mode', required: false, help: 'Model mode: instant | thinking | pro (default: pro)', default: 'pro' },
    { name: 'file', required: false, help: 'Absolute path to a file to attach (e.g. /tmp/report.pdf)' },
  ],
  columns: ['Role', 'Text'],
  func: async (page: IPage | null, kwargs: Record<string, any>) => {
    const text = kwargs.text as string;
    const timeout = parseInt(kwargs.timeout as string, 10) || 300;
    const mode = (kwargs.mode as string) || 'pro';
    const filePath = (kwargs.file as string) || null;

    if (!page) throw new Error('Browser page not available');

    await page.goto('https://chatgpt.com/');
    await page.wait(2);

    // Access CDP bridge from CDPPage (only works with OPENCLI_CDP_ENDPOINT)
    const cdpBridge = (page as any).bridge;
    if (!cdpBridge) throw new Error('CDP bridge not accessible — only works with OPENCLI_CDP_ENDPOINT');

    await selectChatGPTMode(cdpBridge, mode);

    if (filePath) {
      await attachFile(cdpBridge, filePath);
    }

    const snapshot = await page.snapshot({ interactive: true });
    const inputRef =
      snapshot?.nodes?.find((n: any) => n.role === 'textbox' && n.id === 'prompt-textarea')?.ref ??
      snapshot?.nodes?.find((n: any) => n.role === 'textbox' && n.name?.includes('prompt'))?.ref ??
      snapshot?.nodes?.find((n: any) => n.role === 'textbox' && n.placeholder?.toLowerCase().includes('ask'))?.ref;

    if (!inputRef) throw new Error('Could not find ChatGPT input field');

    const messagesBefore = await getVisibleChatMessagesFromPage(page);

    await page.click(inputRef);
    await page.typeText(inputRef, text);

    // Re-focus text area before submitting
    await cdpBridge.send('Runtime.evaluate', {
      expression: `document.getElementById('prompt-textarea')?.focus()`,
      returnByValue: true,
    });
    await new Promise((r) => setTimeout(r, 200));

    // Primary submit: click send button (reliable with or without file attachments)
    const sent = await cdpBridge.send('Runtime.evaluate', {
      expression: `(function() {
        const btn = document.querySelector('[data-testid="send-button"]')
          || document.querySelector('button[aria-label*="Send"]');
        if (!btn) return false;
        const r = btn.getBoundingClientRect();
        return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      })()`,
      returnByValue: true,
    });
    const sendPos = sent?.result?.value ? JSON.parse(sent.result.value) : null;
    if (sendPos) {
      await cdpBridge.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sendPos.x, y: sendPos.y });
      await cdpBridge.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sendPos.x, y: sendPos.y, button: 'left', clickCount: 1 });
      await cdpBridge.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: sendPos.x, y: sendPos.y, button: 'left', clickCount: 1 });
    } else {
      await page.pressKey('Return'); // fallback
    }
    await new Promise((r) => setTimeout(r, 500));

    const deadline = Date.now() + timeout * 1000;
    let response = '';

    while (Date.now() < deadline) {
      await page.wait(5);
      const messagesNow = await getVisibleChatMessagesFromPage(page);
      if (messagesNow.length > messagesBefore.length) {
        const candidate = [...messagesNow.slice(messagesBefore.length)]
          .reverse()
          .find((m) => m !== text);
        if (candidate && candidate.length > 5) {
          let prev = candidate;
          let stableCount = 0;
          for (let i = 0; i < 120; i++) {
            await page.wait(5);
            const latest = await getVisibleChatMessagesFromPage(page);
            const cur = [...latest.slice(messagesBefore.length)].reverse().find((m) => m !== text) || prev;
            // Skip intermediate thinking/generation states
            const isThinking =
              cur.startsWith('Pro thinking') || cur.startsWith('Thinking') ||
              cur.startsWith('Reading') || cur.startsWith('Searching') ||
              cur.startsWith('Analyzing') || cur.startsWith('Writing') ||
              /^(Looking|Processing|Generating|Reviewing|Checking)/i.test(cur);
            if (isThinking) { stableCount = 0; prev = cur; continue; }
            if (cur === prev) { stableCount++; if (stableCount >= 2) break; }
            else { stableCount = 0; prev = cur; }
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
