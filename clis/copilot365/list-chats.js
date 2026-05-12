import { cli, Strategy } from "@jackwener/opencli/registry";
import { ArgumentError, CommandExecutionError } from "@jackwener/opencli/errors";
import { COPILOT365_API_JS, COPILOT365_URL, isCopilot365Url } from "./_lib/shared.js";
const listChatsCommand = cli({
  site: "copilot365",
  name: "list-chats",
  access: "read",
  description: "List recent Microsoft 365 Copilot chats via the substrate.office.com API",
  domain: "m365.cloud.microsoft",
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: "limit", type: "int", default: 25, help: "Maximum chats to return (1\u2013200)" }
  ],
  columns: ["Index", "Title", "ConversationId", "Updated", "LastMessage"],
  func: async (page, kwargs) => {
    const rawLimit = kwargs.limit ?? 25;
    if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 200) {
      throw new ArgumentError(
        "--limit must be an integer between 1 and 200",
        `Got ${rawLimit}. Example: opencli copilot365 list-chats --limit 50`
      );
    }
    const limit = rawLimit;
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
            source: 'officeweb',
            traceId: crypto.randomUUID(),
            threadType: 'webchat',
            MaxReturnedChatsCount: ${limit},
          };
          const variants = 'feature.EnableLastMessageForGetChats,feature.EnableMRUAgents,feature.EnableHasLoopPages';
          const url = 'https://substrate.office.com/m365Copilot/GetChats?request='
            + encodeURIComponent(JSON.stringify(requestObj))
            + '&variants=' + encodeURIComponent(variants);
          const headers = copilotApiHeaders(token, ids.localAccountId, ids.tenantId);
          headers['x-variants'] = variants;
          const res = await fetch(url, { method: 'GET', headers });
          if (!res.ok) {
            const txt = await res.text().catch(() => '');
            return { ok: false, msg: 'GetChats ' + res.status + ': ' + txt.slice(0, 300) };
          }
          const data = await res.json();
          return { ok: true, data };
        } catch (e) {
          return { ok: false, msg: String((e && e.message) || e) };
        }
      })()
    `);
    if (!result || !result.ok) {
      throw new CommandExecutionError(
        `copilot365 list-chats failed: ${result?.msg || "unknown error"}`,
        "Verify the Copilot 365 tab is logged in: opencli copilot365 status"
      );
    }
    const chats = result.data?.chats || [];
    if (chats.length === 0) {
      return [{ Index: 0, Title: "No chats found", ConversationId: "", Updated: "", LastMessage: "" }];
    }
    return chats.map((c, i) => {
      const updated = c.updateTimeUtc ? new Date(c.updateTimeUtc).toISOString().replace("T", " ").slice(0, 19) : "";
      const lastText = (c.lastMessage?.text || "").replace(/\s+/g, " ").slice(0, 80);
      return {
        Index: i + 1,
        Title: (c.chatName || "(untitled)").slice(0, 80),
        ConversationId: c.conversationId || c.threadId || "",
        Updated: updated,
        LastMessage: lastText
      };
    });
  }
});
export {
  listChatsCommand
};
