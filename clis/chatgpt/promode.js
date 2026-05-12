import { cli, Strategy } from '@jackwener/opencli/registry';
import { CommandExecutionError, TimeoutError } from '@jackwener/opencli/errors';
import {
    CHATGPT_DOMAIN,
    ensureChatGPTComposer,
    ensureChatGPTLogin,
    ensureOnChatGPT,
    getBubbleCount,
    getVisibleMessages,
    isGenerating,
    requireNonEmptyPrompt,
    sendChatGPTMessage,
    waitForChatGPTResponse,
} from './utils.js';

// Web ChatGPT model-mode dropdown items. The model selector renders a Radix
// menu whose visible text matches one of these substrings (case-insensitive).
// `pro` maps to the highest-thinking tier; mapping kept liberal to survive
// renames between ChatGPT model generations.
const MODE_MATCHERS = {
    instant: ['instant', 'fast'],
    thinking: ['thinking', 'reasoning'],
    pro: ['pro', 'extended pro', 'o3-pro', 'deep thinking'],
};
const VALID_MODES = Object.keys(MODE_MATCHERS);

/**
 * Open the ChatGPT model selector and click the menu item that matches `mode`.
 *
 * Uses `page.snapshot` / `page.click` (which goes through CDP under the hood
 * and dispatches real mouse events) rather than synthetic clicks — Radix UI
 * dropdowns don't fire on `element.click()` from `page.evaluate`.
 */
async function selectChatGPTMode(page, mode) {
    const wanted = (mode || 'pro').toLowerCase();
    if (!VALID_MODES.includes(wanted)) {
        throw new CommandExecutionError(`Invalid mode "${mode}". Must be one of: ${VALID_MODES.join(', ')}`);
    }
    const matchers = MODE_MATCHERS[wanted];

    // 1. Find and click the model-switcher dropdown trigger.
    const triggerSnap = await page.snapshot({ interactive: true });
    const triggerRef =
        triggerSnap?.nodes?.find((n) => n.testId === 'model-switcher-dropdown-button')?.ref ??
        triggerSnap?.nodes?.find((n) => n.role === 'button' && (n.name || '').toLowerCase().includes('model'))?.ref;
    if (!triggerRef) {
        throw new CommandExecutionError(
            'Could not find ChatGPT model selector — is the page logged in and on chatgpt.com?',
        );
    }
    await page.click(triggerRef);
    await page.wait(0.6);

    // 2. Snapshot the open menu and find the matching item.
    const menuSnap = await page.snapshot({ interactive: true });
    const itemRef = menuSnap?.nodes?.find((n) => {
        if (n.role !== 'menuitem' && n.role !== 'option' && n.role !== 'button') return false;
        const text = ((n.name || '') + ' ' + (n.text || '')).toLowerCase();
        return matchers.some((m) => text.includes(m));
    })?.ref;
    if (!itemRef) {
        throw new CommandExecutionError(
            `Model selector opened but no menu item matched mode "${wanted}". ` +
                `Available items may have been renamed by ChatGPT.`,
        );
    }
    await page.click(itemRef);
    await page.wait(0.5);
}

/**
 * Attach a local file to the composer's hidden file input. Mirrors upstream's
 * uploadChatGPTImages pattern but for the generic #upload-files element used
 * for non-image attachments (PDFs, etc.).
 */
async function attachFile(page, filePath) {
    if (!page.setFileInput) {
        throw new CommandExecutionError(
            'Browser session does not expose setFileInput; cannot attach file.',
        );
    }
    await page.setFileInput([filePath], '#upload-files');
    // Wait for the attach chip to render so the send button enables.
    for (let i = 0; i < 20; i += 1) {
        await page.wait(0.5);
        const ready = await page.evaluate(`
            (() => {
                const sendBtn = document.querySelector('button[data-testid="send-button"], #composer-submit-button');
                return !!(sendBtn && !sendBtn.disabled);
            })()
        `);
        if (ready) return;
    }
    throw new TimeoutError('chatgpt promode attach', 10, 'Send button stayed disabled after attaching the file.');
}

/**
 * Like upstream's waitForChatGPTResponse but tolerates pro mode's longer
 * thinking pauses: requires 3 consecutive stable checks and treats common
 * "Thinking…" / "Searching…" prefixes as in-progress rather than final.
 */
async function waitForProResponse(page, baseline, prompt, timeoutSeconds) {
    const deadline = Date.now() + timeoutSeconds * 1000;
    let lastText = '';
    let stable = 0;
    const isThinkingHeader = (s) => {
        if (!s) return false;
        const head = s.slice(0, 80);
        return /^(Pro thinking|Thinking|Reading|Searching|Analyzing|Writing|Looking|Processing|Generating|Reviewing|Checking|I['’]m|I am)\b/i.test(
            head,
        );
    };
    while (Date.now() < deadline) {
        await page.wait(5);
        if (await isGenerating(page)) {
            stable = 0;
            continue;
        }
        const messages = await getVisibleMessages(page);
        const candidate = [...messages.slice(Math.max(0, baseline))]
            .reverse()
            .find((m) => m.Role === 'Assistant');
        const text = String(candidate?.Text || '').trim();
        if (!text || text === String(prompt || '').trim()) continue;
        if (isThinkingHeader(text)) {
            stable = 0;
            lastText = text;
            continue;
        }
        if (text === lastText) {
            stable += 1;
            if (stable >= 3) return text;
        } else {
            lastText = text;
            stable = 0;
        }
    }
    throw new TimeoutError(
        'chatgpt promode',
        timeoutSeconds,
        'No Pro-mode response within timeout. Re-run with a higher --timeout if it is still generating.',
    );
}

export const promodeCommand = cli({
    site: 'chatgpt',
    name: 'promode',
    access: 'write',
    description: 'Ask ChatGPT in Pro mode (Extended Pro / o3-pro with extended thinking)',
    domain: CHATGPT_DOMAIN,
    strategy: Strategy.COOKIE,
    browser: true,
    siteSession: 'persistent',
    navigateBefore: false,
    timeoutSeconds: 7200,
    args: [
        { name: 'text', positional: true, required: true, help: 'Question or task' },
        { name: 'timeout', type: 'int', default: 600, help: 'Max seconds to wait for response' },
        {
            name: 'mode',
            type: 'str',
            default: 'pro',
            choices: VALID_MODES,
            help: 'Model mode',
        },
        { name: 'file', type: 'str', help: 'Absolute path to a file to attach (e.g. /tmp/report.pdf)' },
    ],
    columns: ['Role', 'Text'],
    func: async (page, kwargs) => {
        const text = requireNonEmptyPrompt(kwargs.text, 'chatgpt promode');
        const timeout = Number(kwargs.timeout) || 600;
        const mode = kwargs.mode || 'pro';
        const filePath = kwargs.file || null;

        await ensureOnChatGPT(page);
        await ensureChatGPTLogin(page, 'ChatGPT promode requires a logged-in ChatGPT session.');
        await ensureChatGPTComposer(page);

        await selectChatGPTMode(page, mode);

        if (filePath) {
            await attachFile(page, filePath);
        }

        const baseline = await getBubbleCount(page);
        const sent = await sendChatGPTMessage(page, text);
        if (!sent) {
            throw new CommandExecutionError('Failed to send prompt to ChatGPT in Pro mode');
        }

        const response = await waitForProResponse(page, baseline, text, timeout);
        return [
            { Role: 'User', Text: text },
            { Role: 'Assistant', Text: response },
        ];
    },
});
