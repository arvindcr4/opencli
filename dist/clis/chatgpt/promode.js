import { cli, Strategy } from '../../registry.js';
import { getVisibleChatMessagesFromPage } from './ax.js';

/**
 * Select a ChatGPT model/mode via the model selector dropdown.
 * Uses CDP mouse events (JS synthetic events don't trigger Radix UI).
 *
 * Modes: 'instant' | 'thinking' | 'pro'
 * The 'pro' mode maps to "Extended Pro" in the composer (o3-pro / research-grade).
 */
async function selectChatGPTMode(bridge, mode = 'pro') {
    // Step 1: Get model selector button position
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

    // Step 2: Open dropdown with real mouse event
    await bridge.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btnPos.x, y: btnPos.y });
    await bridge.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: btnPos.x, y: btnPos.y, button: 'left', clickCount: 1 });
    await bridge.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btnPos.x, y: btnPos.y, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 600));

    // Step 3: Calculate mode item position relative to button
    // Menu x offset: ~+55px from button center; y offsets by mode:
    //   instant  ≈ +86, thinking ≈ +137, pro ≈ +188, configure ≈ +240
    const yOffsets = { instant: 86, thinking: 137, pro: 188, configure: 240 };
    const xOffset = 55;
    const yOffset = yOffsets[mode] ?? 188;
    const itemX = btnPos.x + xOffset;
    const itemY = btnPos.y + yOffset;

    // Step 4: Click mode item (no evaluate between open and click)
    await bridge.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: itemX, y: itemY });
    await new Promise(r => setTimeout(r, 100));
    await bridge.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: itemX, y: itemY, button: 'left', clickCount: 1 });
    await bridge.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: itemX, y: itemY, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 500));
}

/**
 * Attach a local file to the ChatGPT composer via CDP DOM.setFileInputFiles.
 * Resolves the #upload-files input node and sets the file path on it.
 */
async function attachFile(bridge, filePath) {
    await bridge.send('DOM.enable');
    const doc = await bridge.send('DOM.getDocument');
    const fileInput = await bridge.send('DOM.querySelector', {
        nodeId: doc.root.nodeId,
        selector: '#upload-files',
    });
    if (!fileInput?.nodeId) throw new Error('Could not find file input #upload-files');
    await bridge.send('DOM.setFileInputFiles', {
        nodeId: fileInput.nodeId,
        files: [filePath],
    });
    // Wait for upload preview to render
    await new Promise(r => setTimeout(r, 1500));
}

/**
 * Returns true if ChatGPT is still generating (stop button visible).
 */
async function isGenerating(page) {
    const result = await page.evaluate(`
    (function() {
      if (document.querySelector('[data-testid="stop-button"]')) return true;
      const buttons = Array.from(document.querySelectorAll('button'));
      if (buttons.some(b => (b.getAttribute('aria-label') || '').toLowerCase().includes('stop streaming') ||
                             (b.getAttribute('data-testid') || '').includes('stop'))) return true;
      return false;
    })()
  `);
    return !!result;
}

export const promodeCommand = cli({
    site: 'chatgpt',
    name: 'promode',
    description: 'Ask ChatGPT in Pro mode (Extended Pro / o3-pro with extended thinking)',
    domain: 'chatgpt.com',
    strategy: Strategy.PUBLIC,
    browser: true,
    timeoutSeconds: 7200,
    args: [
        { name: 'text', required: true, positional: true, help: 'Question or task' },
        { name: 'timeout', required: false, help: 'Max seconds to wait (default: 300)', default: '300' },
        { name: 'mode', required: false, help: 'Model mode: instant | thinking | pro (default: pro)', default: 'pro' },
        { name: 'file', required: false, help: 'Absolute path to a file to attach (e.g. /tmp/report.pdf)' },
    ],
    columns: ['Role', 'Text'],
    func: async (page, kwargs) => {
        const text = kwargs.text;
        const timeout = parseInt(kwargs.timeout, 10) || 300;
        const mode = kwargs.mode || 'pro';
        const filePath = kwargs.file || null;

        if (!page) throw new Error('Browser page not available');

        // Navigate to new chat
        await page.goto('https://chatgpt.com/');
        await page.wait(2);

        // Select model mode via CDP bridge (page.bridge is CDPBridge)
        const cdpBridge = page.bridge;
        if (!cdpBridge) throw new Error('CDP bridge not accessible — only works with OPENCLI_CDP_ENDPOINT');
        await selectChatGPTMode(cdpBridge, mode);

        // Attach file if provided
        if (filePath) {
            await attachFile(cdpBridge, filePath);
        }

        // Find input
        const snapshot = await page.snapshot({ interactive: true });
        const inputRef =
            snapshot?.nodes?.find(n => n.role === 'textbox' && n.id === 'prompt-textarea')?.ref ??
            snapshot?.nodes?.find(n => n.role === 'textbox' && n.name?.includes('prompt'))?.ref ??
            snapshot?.nodes?.find(n => n.role === 'textbox' && n.placeholder?.toLowerCase().includes('ask'))?.ref;

        if (!inputRef)
            throw new Error('Could not find ChatGPT input field');

        const messagesBefore = await getVisibleChatMessagesFromPage(page);

        await page.click(inputRef);
        await page.typeText(inputRef, text);

        // Re-focus text area before submitting
        await cdpBridge.send('Runtime.evaluate', {
            expression: `document.getElementById('prompt-textarea')?.focus()`,
            returnByValue: true,
        });
        await new Promise(r => setTimeout(r, 200));

        // Primary submit: poll for send button (up to 10s) then click with real mouse events
        let sendPos = null;
        for (let attempt = 0; attempt < 20; attempt++) {
            const sent = await cdpBridge.send('Runtime.evaluate', {
                expression: `(function() {
                  const btn = document.querySelector('[data-testid="send-button"]')
                    || document.querySelector('button[aria-label*="Send"]');
                  if (!btn || btn.disabled) return null;
                  const r = btn.getBoundingClientRect();
                  if (r.width === 0) return null;
                  return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
                })()`,
                returnByValue: true,
            });
            const val = sent?.result?.value ? JSON.parse(sent.result.value) : null;
            if (val) { sendPos = val; break; }
            await new Promise(r => setTimeout(r, 500));
        }
        if (sendPos) {
            await cdpBridge.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: sendPos.x, y: sendPos.y });
            await cdpBridge.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: sendPos.x, y: sendPos.y, button: 'left', clickCount: 1 });
            await cdpBridge.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: sendPos.x, y: sendPos.y, button: 'left', clickCount: 1 });
        } else {
            // Fallback: Enter key
            await page.pressKey('Return');
        }
        await new Promise(r => setTimeout(r, 500));

        // Poll for response — Pro/extended thinking is slow
        const deadline = Date.now() + timeout * 1000;
        let response = '';

        while (Date.now() < deadline) {
            await page.wait(5);
            const messagesNow = await getVisibleChatMessagesFromPage(page);
            if (messagesNow.length > messagesBefore.length) {
                const candidate = [...messagesNow.slice(messagesBefore.length)]
                    .reverse()
                    .find(m => m !== text);
                if (candidate && candidate.length > 50) {
                    let prev = candidate;
                    let stableCount = 0;
                    for (let i = 0; i < 720; i++) { // up to 1 hour after first response
                        await page.wait(5);
                        // If still generating, reset stability counter
                        if (await isGenerating(page)) {
                            stableCount = 0;
                            const latest = await getVisibleChatMessagesFromPage(page);
                            prev = [...latest.slice(messagesBefore.length)].reverse().find(m => m !== text) || prev;
                            continue;
                        }
                        const latest = await getVisibleChatMessagesFromPage(page);
                        const cur = [...latest.slice(messagesBefore.length)].reverse().find(m => m !== text) || prev;
                        const isThinking =
                            cur.startsWith('Pro thinking') || cur.startsWith('Thinking') ||
                            cur.startsWith('Reading') || cur.startsWith('Searching') ||
                            cur.startsWith('Analyzing') || cur.startsWith('Writing') ||
                            cur.startsWith("I'm") || cur.startsWith("I am") ||
                            /^(Looking|Processing|Generating|Reviewing|Checking)/i.test(cur);
                        if (isThinking) {
                            stableCount = 0;
                            prev = cur;
                            continue;
                        }
                        if (cur === prev) {
                            stableCount++;
                            if (stableCount >= 3) break; // stable for 15s and not generating
                        } else {
                            stableCount = 0;
                            prev = cur;
                        }
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
