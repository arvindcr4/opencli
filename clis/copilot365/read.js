import { cli, Strategy } from "@jackwener/opencli/registry";
import {
  COPILOT365_API_JS,
  COPILOT365_URL,
  MESSAGE_SELECTORS,
  extractApiMessages,
  isCopilot365Url
} from "./_lib/shared.js";
const readCommand = cli({
  site: "copilot365",
  name: "read",
  description: "Read the currently-open Microsoft 365 Copilot chat (API first, DOM fallback)",
  domain: "m365.cloud.microsoft",
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: "last", type: "int", default: 0, help: "Only return last N messages (0 = all)" },
    { name: "dom", type: "boolean", default: false, help: "Force DOM scrape (skip the substrate API)" }
  ],
  columns: ["Role", "Text"],
  func: async (page, kwargs) => {
    const last = kwargs.last || 0;
    const forceDom = Boolean(kwargs.dom);
    if (!forceDom) {
      const apiResult = await page.evaluate(`
        (async () => {
          try {
            ${COPILOT365_API_JS}
            // Pull conversation id out of the URL (e.g. .../chat/<convId> or ?id=)
            const u = new URL(window.location.href);
            let conversationId = '';
            const pathMatch = u.pathname.match(/\\/chat\\/([0-9a-fA-F-]{8,})/);
            if (pathMatch) conversationId = pathMatch[1];
            if (!conversationId) conversationId = u.searchParams.get('threadId') || u.searchParams.get('conversationId') || '';
            if (!conversationId) return { ok: false, msg: 'no conversation id in URL; open a chat first or use --dom' };

            const ids = getCopilotIds();
            const token = await getCopilotToken(ids);
            const requestObj = { conversationId, source: 'officeweb', traceId: crypto.randomUUID().replace(/-/g, '') };
            const url = 'https://substrate.office.com/m365Copilot/GetConversation?request='
              + encodeURIComponent(JSON.stringify(requestObj));
            const headers = copilotApiHeaders(token, ids.localAccountId, ids.tenantId);
            const res = await fetch(url, { method: 'GET', headers });
            if (!res.ok) return { ok: false, msg: 'GetConversation ' + res.status };
            const data = await res.json();
            return { ok: true, data, conversationId };
          } catch (e) {
            return { ok: false, msg: String((e && e.message) || e) };
          }
        })()
      `);
      if (apiResult && apiResult.ok) {
        const messages2 = extractApiMessages(apiResult.data);
        if (messages2.length > 0) {
          return last > 0 ? messages2.slice(-last) : messages2;
        }
      }
    }
    const currentUrl = await page.evaluate(`() => window.location.href`);
    if (!isCopilot365Url(currentUrl)) {
      await page.goto(COPILOT365_URL);
      await page.wait(4);
    }
    const messages = await page.evaluate(`
      () => {
        const out = [];
        const turns = document.querySelectorAll(${JSON.stringify(MESSAGE_SELECTORS)});
        const seen = new Set();
        turns.forEach(node => {
          if (seen.has(node)) return;
          seen.add(node);
          const role = (
            node.getAttribute('data-author-role')
            || node.getAttribute('data-message-author-role')
            || node.getAttribute('data-tid')
            || ''
          ).toLowerCase();
          const isUser = role === 'user' || role.includes('user');
          const text = (node.innerText || node.textContent || '').trim();
          if (!text || text.length < 2) return;
          out.push({ Role: isUser ? 'User' : 'Copilot', Text: text.substring(0, 4000) });
        });
        return out;
      }
    `);
    if (!messages || messages.length === 0) {
      return [{ Role: "System", Text: "No conversation found (API returned nothing and DOM was empty)." }];
    }
    return last > 0 ? messages.slice(-last) : messages;
  }
});
export {
  readCommand
};
