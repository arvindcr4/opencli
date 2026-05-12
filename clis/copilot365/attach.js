import { cli, Strategy } from "@jackwener/opencli/registry";
import { COPILOT365_URL, copilotDomAttach, isCopilot365Url } from "./_lib/shared.js";
const attachCommand = cli({
  site: "copilot365",
  name: "attach",
  access: "write",
  description: "Attach a local file to the current Microsoft 365 Copilot chat",
  domain: "m365.cloud.microsoft",
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: "file", type: "string", required: true, positional: true, help: "Path to local file (PDF/DOCX/XLSX/PPTX/TXT/CSV/PNG/JPG; <50 MB)" },
    { name: "mime", type: "string", required: false, help: "Override MIME type (auto-detected from extension by default)" }
  ],
  columns: ["Status"],
  func: async (page, kwargs) => {
    const filePath = kwargs.file;
    const mime = kwargs.mime;
    const currentUrl = await page.evaluate(`() => window.location.href`);
    if (!isCopilot365Url(currentUrl)) {
      await page.goto(COPILOT365_URL);
      await page.wait(5);
    }
    const result = await copilotDomAttach(page, filePath, mime);
    if (!result.ok) return [{ Status: "[ATTACH FAILED] " + JSON.stringify(result) }];
    return [{ Status: result.msg }];
  }
});
export {
  attachCommand
};
