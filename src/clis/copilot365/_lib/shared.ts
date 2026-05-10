/**
 * Shared helpers for the Microsoft 365 Copilot adapter.
 *
 * Targets the enterprise Copilot at https://m365.cloud.microsoft/chat
 * (and its sibling hosts copilot.cloud.microsoft / www.office.com/chat).
 *
 * The adapter uses two interaction modes:
 *  1. DOM injection (chat / send / send-prompt / new) — fragile, depends on
 *     Fluent UI selectors that Microsoft changes frequently.
 *  2. Substrate REST API (status / list-chats / read / get-chat) — robust,
 *     calls https://substrate.office.com/m365Copilot/* directly using the
 *     MSAL bearer token decrypted from the page's LocalStorage cache.
 *
 * The token-decryption logic in COPILOT365_API_JS is ported from
 *   https://github.com/ganyuke/copilot-exporter (MIT, ganyuke)
 * which itself ports MSAL crypto from
 *   https://github.com/AzureAD/microsoft-authentication-library-for-js (MIT, Microsoft).
 */

export const COPILOT365_URL = 'https://m365.cloud.microsoft/chat';

export const COPILOT365_HOSTS = [
  'm365.cloud.microsoft',
  'copilot.cloud.microsoft',
  'www.office.com',
  'office.com',
];

export function isCopilot365Url(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return COPILOT365_HOSTS.some(h => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

// ──────────────── DOM-mode selectors (still guesses) ────────────────

export const FIND_INPUT_JS = `
function findCopilotInput() {
  const candidates = [
    'div[contenteditable="true"][data-tid*="ChatInput"]',
    'div[contenteditable="true"][data-testid*="chat-input"]',
    'div[contenteditable="true"][aria-label*="ask" i]',
    'div[contenteditable="true"][aria-label*="message" i]',
    'div[contenteditable="true"][aria-label*="copilot" i]',
    'textarea[aria-label*="ask" i]',
    'textarea[aria-label*="message" i]',
    'div[role="textbox"][contenteditable="true"]',
    'div[contenteditable="true"]',
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el && el.offsetParent !== null) return el;
  }
  return null;
}
`;

export const FIND_SEND_BUTTON_JS = `
function findCopilotSendButton() {
  const candidates = [
    'button[data-tid*="send"]',
    'button[data-testid*="send"]',
    'button[aria-label="Send"]',
    'button[aria-label*="Send" i]',
    'button[aria-label*="Submit" i]',
    'button[type="submit"]',
  ];
  for (const sel of candidates) {
    const btns = Array.from(document.querySelectorAll(sel));
    const visible = btns.find(b => b.offsetParent !== null && !b.disabled);
    if (visible) return visible;
  }
  return null;
}
`;

export const MESSAGE_SELECTORS = [
  '[data-tid*="message-"]',
  '[data-testid*="message"]',
  '[data-author-role]',
  '[data-message-author-role]',
  'article[role="article"]',
  'div[role="article"]',
].join(', ');

// ──────────────── Substrate API mode (port of ganyuke/copilot-exporter) ────────────────

export const COPILOT365_CLIENT_ID = 'c0ab8ce9-e9a0-42e7-b064-33d422df41f1';
export const COPILOT365_TOKEN_SCOPE = 'https://substrate.office.com/sydney/.default';

/**
 * Self-contained JS evaluated inside page.evaluate(). Exposes:
 *   - getCopilotIds() → { clientId, tenantId, localAccountId, homeAccountId, upn }
 *   - getCopilotToken(ids) → Promise<string>  (bearer JWT)
 *   - copilotApiHeaders(token, localAccountId, tenantId, scenario?) → object
 *   - copilotFetch(path, init?) → Promise<json>
 *
 * Each command pastes COPILOT365_API_JS into its evaluate string and then
 * calls these helpers from an async IIFE.
 */
export const COPILOT365_API_JS = `
const COPILOT365_CLIENT_ID = ${JSON.stringify(COPILOT365_CLIENT_ID)};
const COPILOT365_TOKEN_SCOPE = ${JSON.stringify(COPILOT365_TOKEN_SCOPE)};
const COPILOT365_ENCRYPTION_COOKIE = 'msal.cache.encryption';
const COPILOT365_API_BASE = 'https://substrate.office.com/m365Copilot';

function _readCookie(key) {
  const m = document.cookie.match('(^|;)\\\\s*' + key + '\\\\s*=\\\\s*([^;]+)');
  return m ? m.pop() : '';
}

function _b64ToU8(base64) {
  let s = base64.replace(/-/g, '+').replace(/_/g, '/');
  switch (s.length % 4) {
    case 0: break;
    case 2: s += '=='; break;
    case 3: s += '='; break;
    default: throw new Error('bad base64 length');
  }
  const bin = atob(s);
  return Uint8Array.from(bin, c => c.codePointAt(0) || 0);
}

function _u8ToBuf(u8) { return Uint8Array.from(u8).buffer; }

async function _importHkdfKey(rawBytes) {
  return window.crypto.subtle.importKey('raw', _u8ToBuf(rawBytes), 'HKDF', false, ['deriveKey']);
}

async function _deriveKey(baseKey, nonce, context) {
  return window.crypto.subtle.deriveKey(
    { name: 'HKDF', salt: _u8ToBuf(nonce), hash: 'SHA-256', info: new TextEncoder().encode(context) },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function _decryptMsal(baseKey, nonceB64, context, dataB64) {
  const data = _b64ToU8(dataB64);
  const nonce = _b64ToU8(nonceB64);
  const key = await _deriveKey(baseKey, nonce, context);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(12) },
    key,
    _u8ToBuf(data)
  );
  return new TextDecoder().decode(decrypted);
}

async function _getEncryptionCookie() {
  const raw = decodeURIComponent(_readCookie(COPILOT365_ENCRYPTION_COOKIE));
  if (!raw) throw new Error('No msal.cache.encryption cookie. Are you signed in to m365.cloud.microsoft?');
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { throw new Error('Failed to parse msal.cache.encryption cookie'); }
  if (!parsed.key || !parsed.id) throw new Error('msal.cache.encryption cookie missing key/id');
  return { id: parsed.id, key: await _importHkdfKey(_b64ToU8(parsed.key)) };
}

function getCopilotIds() {
  const el = document.getElementById('identity');
  if (!el || !el.textContent) {
    throw new Error('No <div id="identity"> on the page. Open https://m365.cloud.microsoft and sign in first.');
  }
  let identity;
  try { identity = JSON.parse(el.textContent); }
  catch (e) { throw new Error('Failed to parse #identity JSON: ' + e); }
  const tenantId = identity.tenantId;
  const localAccountId = identity.objectId;
  const upn = identity.userPrincipalName || '';
  return {
    clientId: COPILOT365_CLIENT_ID,
    tenantId,
    localAccountId,
    homeAccountId: localAccountId + '.' + tenantId,
    upn,
  };
}

async function getCopilotToken(ids) {
  const enc = await _getEncryptionCookie();
  const lsKey =
    ids.homeAccountId + '-login.windows.net-accesstoken-' +
    ids.clientId + '-' + ids.tenantId + '-' + COPILOT365_TOKEN_SCOPE + '--';
  const raw = localStorage.getItem(lsKey);
  if (!raw) {
    throw new Error('No MSAL access token in LocalStorage at key=' + lsKey
      + '. Open https://m365.cloud.microsoft/chat once to seed the token, then retry.');
  }
  const payload = JSON.parse(raw);
  if (payload.id && payload.id !== enc.id) {
    throw new Error('Encryption-cookie id does not match the stored token id (stale session). Reload the page.');
  }
  const decryptedJson = await _decryptMsal(enc.key, payload.nonce, ids.clientId, payload.data);
  const tokenEntry = JSON.parse(decryptedJson);
  if (!tokenEntry.secret) throw new Error('Decrypted token entry missing .secret');
  const now = Math.floor(Date.now() / 1000);
  if (tokenEntry.expiresOn && parseInt(tokenEntry.expiresOn, 10) < now) {
    console.warn('[copilot365] access token already expired; substrate will likely return 401');
  }
  return tokenEntry.secret;
}

function copilotApiHeaders(token, localAccountId, tenantId, scenario) {
  return {
    'authorization': 'Bearer ' + token,
    'content-type': 'application/json',
    'x-anchormailbox': 'Oid:' + localAccountId + '@' + tenantId,
    'x-clientrequestid': crypto.randomUUID().replace(/-/g, ''),
    'x-routingparameter-sessionkey': localAccountId,
    'x-scenario': scenario || 'OfficeWebIncludedCopilot',
  };
}

async function copilotFetch(path, init) {
  const ids = getCopilotIds();
  const token = await getCopilotToken(ids);
  const headers = Object.assign(copilotApiHeaders(token, ids.localAccountId, ids.tenantId), (init && init.headers) || {});
  const res = await fetch(COPILOT365_API_BASE + path, Object.assign({ method: 'GET' }, init, { headers }));
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error('substrate ' + path + ' returned ' + res.status + ': ' + text.slice(0, 300));
  }
  return res.json();
}
`;
