import { readFileSync } from "node:fs";
import { cli, Strategy } from "@jackwener/opencli/registry";
import {
  COPILOT365_URL,
  MESSAGE_SELECTORS,
  copilotDomSend,
  isCopilot365Url
} from "./_lib/shared.js";
const chatCommand = cli({
  site: "copilot365",
  name: "chat",
  description: "Send a prompt to Microsoft 365 Copilot and wait for the reply",
  domain: "m365.cloud.microsoft",
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: "prompt", type: "string", required: false, positional: true, help: "Prompt to send (or use --file)" },
    { name: "file", type: "string", required: false, help: "Read prompt from this file instead of positional arg" },
    { name: "timeout", type: "int", default: 120, help: "Max seconds to wait for the reply (default: 120)" },
    { name: "new", type: "boolean", default: false, help: "Start a new chat before sending" }
  ],
  columns: ["Role", "Text"],
  timeoutSeconds: 180,
  func: async (page, kwargs) => {
    const promptArg = kwargs.prompt;
    const filePath = kwargs.file;
    const text = filePath ? readFileSync(filePath, "utf8").trim() : (promptArg ?? "").trim();
    if (!text) {
      throw new Error("No prompt provided. Pass a positional string or --file <path>.");
    }
    const timeoutMs = (kwargs.timeout || 120) * 1e3;
    const newChat = Boolean(kwargs.new);
    const currentUrl = await page.evaluate(`() => window.location.href`);
    if (!isCopilot365Url(currentUrl) || newChat) {
      await page.goto(COPILOT365_URL);
      await page.wait(5);
    } else {
      await page.wait(1);
    }
    const beforeCount = await page.evaluate(`
      () => document.querySelectorAll(${JSON.stringify(MESSAGE_SELECTORS)}).length
    `);
    const sendResult = await copilotDomSend(page, text);
    if (!sendResult.ok) {
      return [
        { Role: "User", Text: text },
        { Role: "System", Text: "[SEND FAILED] " + JSON.stringify(sendResult) }
      ];
    }
    const startTime = Date.now();
    let lastText = "";
    let stableCount = 0;
    while (Date.now() - startTime < timeoutMs) {
      await page.wait(3);
      const candidate = await page.evaluate(`
        () => {
          const turns = document.querySelectorAll(${JSON.stringify(MESSAGE_SELECTORS)});
          if (turns.length <= ${beforeCount}) return '';
          for (let i = turns.length - 1; i >= ${beforeCount}; i--) {
            const node = turns[i];
            const role = node.getAttribute('data-author-role')
              || node.getAttribute('data-message-author-role')
              || (node.getAttribute('data-tid') || '').toLowerCase();
            const isUser = role === 'user' || role.includes('user');
            if (isUser) continue;
            const text = (node.innerText || node.textContent || '').trim();
            if (text && text.length > 1) return text;
          }
          return '';
        }
      `);
      if (candidate && candidate.length > 1) {
        if (candidate === lastText) {
          stableCount++;
          if (stableCount >= 2) {
            return [
              { Role: "User", Text: text },
              { Role: "Copilot", Text: candidate }
            ];
          }
        } else {
          stableCount = 0;
        }
        lastText = candidate;
      }
    }
    if (lastText) {
      return [
        { Role: "User", Text: text },
        { Role: "Copilot", Text: lastText }
      ];
    }
    return [
      { Role: "User", Text: text },
      { Role: "System", Text: `No response within ${timeoutMs / 1e3}s. Copilot may still be generating.` }
    ];
  }
});
export {
  chatCommand
};
