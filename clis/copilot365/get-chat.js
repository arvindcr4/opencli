import { cli, Strategy } from "@jackwener/opencli/registry";
import {
  COPILOT365_API_JS,
  COPILOT365_URL,
  extractApiMessages,
  isCopilot365Url
} from "./_lib/shared.js";
const getChatCommand = cli({
  site: "copilot365",
  name: "get-chat",
  description: "Fetch a specific Microsoft 365 Copilot conversation by id via the substrate API",
  domain: "m365.cloud.microsoft",
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: "id", type: "string", required: true, positional: true, help: "Conversation id (uuid) \u2014 get from `list-chats`" },
    { name: "last", type: "int", default: 0, help: "Only return last N messages (0 = all)" }
  ],
  columns: ["Turn", "Role", "Text"],
  func: async (page, kwargs) => {
    const conversationId = kwargs.id;
    const last = kwargs.last || 0;
    const currentUrl = await page.evaluate(`() => window.location.href`);
    if (!isCopilot365Url(currentUrl)) {
      await page.goto(COPILOT365_URL);
      await page.wait(5);
    }
    const result = await page.evaluate(`
      (async () => {
        try {
          ${COPILOT365_API_JS}
          const ids = getCopilotIds();
          const token = await getCopilotToken(ids);
          const requestObj = {
            conversationId: ${JSON.stringify(conversationId)},
            source: 'officeweb',
            traceId: crypto.randomUUID().replace(/-/g, ''),
          };
          const url = 'https://substrate.office.com/m365Copilot/GetConversation?request='
            + encodeURIComponent(JSON.stringify(requestObj));
          const headers = copilotApiHeaders(token, ids.localAccountId, ids.tenantId);
          const res = await fetch(url, { method: 'GET', headers });
          if (!res.ok) {
            const txt = await res.text().catch(() => '');
            return { ok: false, msg: 'GetConversation ' + res.status + ': ' + txt.slice(0, 300) };
          }
          const data = await res.json();
          return { ok: true, data };
        } catch (e) {
          return { ok: false, msg: String((e && e.message) || e) };
        }
      })()
    `);
    if (!result || !result.ok) {
      return [{ Turn: 0, Role: "System", Text: "[ERROR] " + (result?.msg || "unknown") }];
    }
    const base = extractApiMessages(result.data);
    if (base.length === 0) {
      return [{ Turn: 0, Role: "System", Text: "Conversation has no readable messages" }];
    }
    const numbered = base.map((m, i) => ({ Turn: i + 1, Role: m.Role, Text: m.Text }));
    return last > 0 ? numbered.slice(-last) : numbered;
  }
});
export {
  getChatCommand
};
