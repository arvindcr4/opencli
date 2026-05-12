import { readFileSync } from "node:fs";
import { cli, Strategy } from "@jackwener/opencli/registry";
import { COPILOT365_URL, copilotDomSend, isCopilot365Url } from "./_lib/shared.js";
const sendCommand = cli({
  site: "copilot365",
  name: "send",
  description: "Fire-and-forget: send a message to Microsoft 365 Copilot without waiting for the reply",
  domain: "m365.cloud.microsoft",
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: "text", type: "string", required: false, positional: true, help: "Message text (or use --file)" },
    { name: "file", type: "string", required: false, help: "Read message from this file" }
  ],
  columns: ["Status"],
  func: async (page, kwargs) => {
    const filePath = kwargs.file;
    const positional = kwargs.text;
    const text = filePath ? readFileSync(filePath, "utf8").trim() : (positional ?? "").trim();
    if (!text) throw new Error("No message provided. Pass a positional string or --file <path>.");
    const currentUrl = await page.evaluate(`() => window.location.href`);
    if (!isCopilot365Url(currentUrl)) {
      await page.goto(COPILOT365_URL);
      await page.wait(5);
    }
    const result = await copilotDomSend(page, text);
    if (!result.ok) return [{ Status: "[SEND FAILED] " + JSON.stringify(result) }];
    return [{ Status: "Sent (" + result.msg + ")" }];
  }
});
export {
  sendCommand
};
