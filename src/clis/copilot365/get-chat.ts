import { cli, Strategy } from '../../registry.js';
import type { IPage } from '../../types.js';
import { COPILOT365_API_JS, COPILOT365_URL, isCopilot365Url } from './_lib/shared.js';

export const getChatCommand = cli({
  site: 'copilot365',
  name: 'get-chat',
  description: 'Fetch a specific Microsoft 365 Copilot conversation by id via the substrate API',
  domain: 'm365.cloud.microsoft',
  strategy: Strategy.COOKIE,
  browser: true,
  args: [
    { name: 'id', type: 'string', required: true, positional: true, help: 'Conversation id (uuid) — get from `list-chats`' },
    { name: 'last', type: 'int', default: 0, help: 'Only return last N messages (0 = all)' },
  ],
  columns: ['Turn', 'Role', 'Text'],
  func: async (page: IPage, kwargs: Record<string, any>) => {
    const conversationId = kwargs.id as string;
    const last = (kwargs.last as number) || 0;

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
      return [{ Turn: 0, Role: 'System', Text: '[ERROR] ' + (result?.msg || 'unknown') }];
    }

    const messages: Array<{ Turn: number; Role: string; Text: string }> = [];
    const candidates: any[] =
      result.data?.messages
      || result.data?.conversation?.messages
      || result.data?.value
      || [];
    let turn = 0;
    for (const m of candidates) {
      if (!m) continue;
      const role = (m.author || m.role || '').toLowerCase();
      let text: string = m.text || '';
      if (!text && Array.isArray(m.adaptiveCards)) {
        for (const card of m.adaptiveCards) {
          if (Array.isArray(card?.body)) {
            for (const b of card.body) if (typeof b?.text === 'string') text += (text ? '\n' : '') + b.text;
          }
        }
      }
      text = (text || '').trim();
      if (!text) continue;
      turn += 1;
      messages.push({
        Turn: turn,
        Role: role === 'user' ? 'User' : 'Copilot',
        Text: text.slice(0, 4000),
      });
    }
    if (messages.length === 0) {
      return [{ Turn: 0, Role: 'System', Text: 'Conversation has no readable messages' }];
    }
    return last > 0 ? messages.slice(-last) : messages;
  },
});
