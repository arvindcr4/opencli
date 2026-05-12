import { readFileSync } from "node:fs";
import * as path from "node:path";
const COPILOT365_URL = "https://m365.cloud.microsoft/chat";
const COPILOT365_HOSTS = [
  "m365.cloud.microsoft",
  "copilot.cloud.microsoft",
  "www.office.com",
  "office.com"
];
function isCopilot365Url(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return COPILOT365_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}
const FIND_INPUT_JS = `
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
const FIND_SEND_BUTTON_JS = `
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
const MESSAGE_SELECTORS = [
  '[data-tid*="message-"]',
  '[data-testid*="message"]',
  "[data-author-role]",
  "[data-message-author-role]",
  'article[role="article"]',
  'div[role="article"]'
].join(", ");
const COPILOT365_CLIENT_ID = "c0ab8ce9-e9a0-42e7-b064-33d422df41f1";
const COPILOT365_TOKEN_SCOPE = "https://substrate.office.com/sydney/.default";
const COPILOT365_API_JS = `
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
function extractApiMessages(apiData) {
  const out = [];
  const candidates = apiData?.messages || apiData?.conversation?.messages || apiData?.value || (Array.isArray(apiData) ? apiData : []);
  for (const m of candidates) {
    if (!m) continue;
    const role = (m.author || m.role || "").toLowerCase();
    let text = m.text || "";
    if (!text && Array.isArray(m.adaptiveCards)) {
      for (const card of m.adaptiveCards) {
        if (Array.isArray(card?.body)) {
          for (const b of card.body) if (typeof b?.text === "string") text += (text ? "\n" : "") + b.text;
        }
      }
    }
    text = (text || "").trim();
    if (!text) continue;
    out.push({ Role: role === "user" ? "User" : "Copilot", Text: text.slice(0, 4e3) });
  }
  return out;
}
async function copilotDomSend(page, text) {
  const promptJson = JSON.stringify(text);
  const result = await page.evaluate(`
    (async () => {
      try {
        ${FIND_INPUT_JS}
        ${FIND_SEND_BUTTON_JS}
        const editor = findCopilotInput();
        if (!editor) return { ok: false, msg: 'no Copilot input found' };

        editor.focus();
        if (editor.tagName === 'TEXTAREA' || editor.tagName === 'INPUT') {
          editor.value = ${promptJson};
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editor);
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand('insertText', false, ${promptJson});
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }

        await new Promise(r => setTimeout(r, 600));

        const sendBtn = findCopilotSendButton();
        if (sendBtn && !sendBtn.disabled) {
          sendBtn.click();
          return { ok: true, msg: 'clicked-send' };
        }

        editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        editor.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', bubbles: true }));
        editor.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
        return { ok: true, msg: 'enter-key-fallback' };
      } catch (e) {
        return { ok: false, msg: String(e) };
      }
    })()
  `);
  return result || { ok: false, msg: "page.evaluate returned null" };
}
const MIME_BY_EXT = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  html: "text/html",
  htm: "text/html"
};
function guessMime(filename) {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  return MIME_BY_EXT[ext] || "application/octet-stream";
}
async function copilotDomAttach(page, filePath, mimeType) {
  let buf;
  try {
    buf = readFileSync(filePath);
  } catch (e) {
    return { ok: false, msg: `Cannot read file ${filePath}: ${e?.message || e}` };
  }
  const sizeMb = buf.length / 1024 / 1024;
  if (sizeMb > 50) {
    return {
      ok: false,
      msg: `File too large: ${sizeMb.toFixed(1)} MB (limit: 50 MB). Attach via the M365 web UI directly.`
    };
  }
  if (sizeMb > 25) {
    console.warn(`[copilot365] attaching ${sizeMb.toFixed(1)} MB; the bridge may stall on files this large`);
  }
  const filename = path.basename(filePath);
  const mime = mimeType || guessMime(filename);
  const base64 = buf.toString("base64");
  const result = await page.evaluate(`
    (async () => {
      try {
        function _b64ToU8(b64) {
          const bin = atob(b64);
          const arr = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          return arr;
        }

        // Step 1: try to surface a file input by clicking the attach affordance.
        // Copilot 365 hides the <input type="file"> until the user opens the
        // attach menu, so we click the most likely buttons first.
        const attachBtnSelectors = [
          'button[data-tid*="attach" i]',
          'button[data-testid*="attach" i]',
          'button[aria-label*="ttach" i]',
          'button[aria-label*="dd files" i]',
          'button[aria-label*="dd content" i]',
          'button[aria-label*="upload" i]',
          'button[aria-label*="ttachment" i]',
        ];
        for (const sel of attachBtnSelectors) {
          const btn = document.querySelector(sel);
          if (btn && btn.offsetParent !== null && !btn.disabled) {
            btn.click();
            await new Promise(r => setTimeout(r, 400));
            break;
          }
        }

        // Step 2: if a menu opened, click the "device upload" option.
        const optionSelectors = [
          'button[role="menuitem"][aria-label*="device" i]',
          'button[role="menuitem"][aria-label*="this device" i]',
          'button[role="menuitem"][aria-label*="omputer" i]',
          'button[role="menuitem"][aria-label*="upload" i]',
          'div[role="menuitem"][aria-label*="device" i]',
        ];
        for (const sel of optionSelectors) {
          const opt = document.querySelector(sel);
          if (opt && opt.offsetParent !== null) {
            opt.click();
            await new Promise(r => setTimeout(r, 400));
            break;
          }
        }

        // Step 3: locate the file input. Prefer one accepting our mime, fall
        // back to any visible-or-hidden <input type="file">.
        let input = null;
        const allInputs = Array.from(document.querySelectorAll('input[type="file"]'));
        input = allInputs.find(el => {
          const accept = (el.getAttribute('accept') || '').toLowerCase();
          return !accept || accept.includes('*') || accept.includes(${JSON.stringify(mime)}) || accept.includes(${JSON.stringify("." + (filename.split(".").pop() || ""))});
        }) || allInputs[0] || null;
        if (!input) return { ok: false, msg: 'No <input type="file"> found after clicking attach affordance' };

        // Step 4: build the File and set it.
        const bytes = _b64ToU8(${JSON.stringify(base64)});
        const file = new File([bytes], ${JSON.stringify(filename)}, { type: ${JSON.stringify(mime)} });
        const dt = new DataTransfer();
        dt.items.add(file);
        try {
          input.files = dt.files;
        } catch (e) {
          // Some browsers reject direct .files assignment in privileged contexts;
          // dispatch a synthetic drop on the input as a fallback.
          input.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
        }
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true, msg: 'attached ' + ${JSON.stringify(filename)} + ' (' + ${JSON.stringify(mime)} + ', ' + (file.size) + ' bytes)' };
      } catch (e) {
        return { ok: false, msg: String((e && e.message) || e) };
      }
    })()
  `);
  return result || { ok: false, msg: "page.evaluate returned null" };
}
export {
  COPILOT365_API_JS,
  COPILOT365_CLIENT_ID,
  COPILOT365_HOSTS,
  COPILOT365_TOKEN_SCOPE,
  COPILOT365_URL,
  FIND_INPUT_JS,
  FIND_SEND_BUTTON_JS,
  MESSAGE_SELECTORS,
  copilotDomAttach,
  copilotDomSend,
  extractApiMessages,
  guessMime,
  isCopilot365Url
};
