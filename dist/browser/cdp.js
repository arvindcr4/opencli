/**
 * CDP client — implements IPage by connecting directly to a Chrome/Electron CDP WebSocket.
 */
import { WebSocket } from 'ws';
import { wrapForEval } from './utils.js';
export class CDPBridge {
    _ws = null;
    _idCounter = 0;
    _pending = new Map();
    _tabId = null;
    _baseEndpoint = null;
    async connect(opts) {
        const endpoint = process.env.OPENCLI_CDP_ENDPOINT;
        if (!endpoint)
            throw new Error('OPENCLI_CDP_ENDPOINT is not set');
        // If it's a direct ws:// URL, use it. Otherwise, create a new isolated tab.
        let wsUrl = endpoint;
        if (endpoint.startsWith('http')) {
            const base = endpoint.replace(/\/$/, '');
            this._baseEndpoint = base;
            // Create a fresh tab so concurrent opencli processes don't share a tab
            // Chrome requires PUT for /json/new (GET returns 405)
            const res = await fetch(`${base}/json/new?url=about:blank`, { method: 'PUT' });
            if (!res.ok)
                throw new Error(`Failed to create new CDP tab: ${res.statusText}`);
            const target = await res.json();
            if (!target?.webSocketDebuggerUrl)
                throw new Error('No webSocketDebuggerUrl in new tab response');
            wsUrl = target.webSocketDebuggerUrl;
            this._tabId = target.id ?? null;
        }
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(wsUrl);
            const timeout = setTimeout(() => reject(new Error('CDP connect timeout')), opts?.timeout ?? 10000);
            ws.on('open', () => {
                clearTimeout(timeout);
                this._ws = ws;
                resolve(new CDPPage(this));
            });
            ws.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.id && this._pending.has(msg.id)) {
                        const { resolve, reject } = this._pending.get(msg.id);
                        this._pending.delete(msg.id);
                        if (msg.error) {
                            reject(new Error(msg.error.message));
                        }
                        else {
                            resolve(msg.result);
                        }
                    }
                }
                catch (e) {
                    // ignore parsing errors
                }
            });
        });
    }
    async close() {
        if (this._ws) {
            this._ws.close();
            this._ws = null;
        }
        for (const p of this._pending.values()) {
            p.reject(new Error('CDP connection closed'));
        }
        this._pending.clear();
        // Close the tab we created so Chrome doesn't accumulate orphaned tabs
        if (this._tabId && this._baseEndpoint) {
            try { await fetch(`${this._baseEndpoint}/json/close/${this._tabId}`); } catch { /* ignore */ }
            this._tabId = null;
        }
    }
    async send(method, params = {}) {
        if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
            throw new Error('CDP connection is not open');
        }
        const id = ++this._idCounter;
        return new Promise((resolve, reject) => {
            this._pending.set(id, { resolve, reject });
            this._ws.send(JSON.stringify({ id, method, params }));
        });
    }
}
class CDPPage {
    bridge;
    constructor(bridge) {
        this.bridge = bridge;
    }
    async goto(url) {
        await this.bridge.send('Page.navigate', { url });
        await new Promise(r => setTimeout(r, 1000));
    }
    async evaluate(js) {
        const expression = wrapForEval(js);
        const result = await this.bridge.send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true
        });
        if (result.exceptionDetails) {
            throw new Error('Evaluate error: ' + (result.exceptionDetails.exception?.description || 'Unknown exception'));
        }
        return result.result?.value;
    }
    async snapshot(opts = {}) {
        const code = `
(function() {
  const sel = 'a, button, input, select, textarea, [contenteditable="true"], [role="button"], [role="textbox"], [role="combobox"], [role="searchbox"], [tabindex]';
  const elements = document.querySelectorAll(sel);
  const nodes = [];
  elements.forEach(function(el, i) {
    const ref = 'snap-' + i;
    el.setAttribute('data-ref', ref);
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role') || (tag === 'a' ? 'link' : tag === 'button' ? 'button' : tag === 'input' ? (el.type === 'checkbox' ? 'checkbox' : el.type === 'radio' ? 'radio' : 'textbox') : tag === 'textarea' ? 'textbox' : el.getAttribute('contenteditable') ? 'textbox' : tag);
    const id = el.id || '';
    const name = el.getAttribute('aria-label') || el.getAttribute('name') || el.getAttribute('title') || (el.textContent || '').trim().slice(0, 80) || id || '';
    const placeholder = el.getAttribute('placeholder') || '';
    nodes.push({ role: role, name: name, placeholder: placeholder, id: id, ref: ref });
  });
  return JSON.stringify({ nodes: nodes });
})()`;
        const raw = await this.evaluate(code);
        try { return JSON.parse(raw); } catch { return { nodes: [] }; }
    }
    async click(ref) {
        const safeRef = JSON.stringify(ref);
        const code = `
      (() => {
        const ref = ${safeRef};
        const el = document.querySelector('[data-ref="' + ref + '"]')
          || document.querySelectorAll('a, button, input, [role="button"], [tabindex]')[parseInt(ref, 10) || 0];
        if (!el) throw new Error('Element not found: ' + ref);
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
        el.click();
        return 'clicked';
      })()
    `;
        await this.evaluate(code);
    }
    async typeText(ref, text) {
        const safeRef = JSON.stringify(ref);
        const code = `
      (() => {
        const ref = ${safeRef};
        const el = document.querySelector('[data-ref="' + ref + '"]')
          || document.querySelectorAll('input, textarea, [contenteditable]')[parseInt(ref, 10) || 0];
        if (!el) throw new Error('Element not found: ' + ref);
        el.focus();
        return 'focused';
      })()
    `;
        await this.evaluate(code);
        // Use CDP Input.insertText for reliable typing into contenteditable/ProseMirror
        await this.bridge.send('Input.insertText', { text });
    }
    async pressKey(key) {
        // Use CDP Input.dispatchKeyEvent for reliable key dispatch
        const keyMap = { 'Return': { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 } };
        const k = keyMap[key] || { key, code: key };
        await this.bridge.send('Input.dispatchKeyEvent', { type: 'keyDown', ...k });
        await this.bridge.send('Input.dispatchKeyEvent', { type: 'keyUp', ...k });
    }
    async wait(options) {
        if (typeof options === 'number') {
            await new Promise(resolve => setTimeout(resolve, options * 1000));
            return;
        }
        if (options.time) {
            await new Promise(resolve => setTimeout(resolve, options.time * 1000));
            return;
        }
        if (options.text) {
            const timeout = (options.timeout ?? 30) * 1000;
            const code = `
        new Promise((resolve, reject) => {
          const deadline = Date.now() + ${timeout};
          const check = () => {
            if (document.body.innerText.includes(${JSON.stringify(options.text)})) return resolve('found');
            if (Date.now() > deadline) return reject(new Error('Text not found: ' + ${JSON.stringify(options.text)}));
            setTimeout(check, 200);
          };
          check();
        })
      `;
            await this.evaluate(code);
        }
    }
    async tabs() {
        throw new Error('Method not implemented.');
    }
    async closeTab(index) {
        throw new Error('Method not implemented.');
    }
    async newTab() {
        throw new Error('Method not implemented.');
    }
    async selectTab(index) {
        throw new Error('Method not implemented.');
    }
    async networkRequests(includeStatic) {
        throw new Error('Method not implemented.');
    }
    async consoleMessages(level) {
        throw new Error('Method not implemented.');
    }
    async scroll(direction, amount) {
        throw new Error('Method not implemented.');
    }
    async autoScroll(options) {
        throw new Error('Method not implemented.');
    }
    async installInterceptor(pattern) {
        throw new Error('Method not implemented.');
    }
    async getInterceptedRequests() {
        throw new Error('Method not implemented.');
    }
    async screenshot(options) {
        throw new Error('Method not implemented.');
    }
}
function selectCDPTarget(targets) {
    const preferredPattern = compilePreferredPattern(process.env.OPENCLI_CDP_TARGET);
    const ranked = targets
        .map((target, index) => ({ target, index, score: scoreCDPTarget(target, preferredPattern) }))
        .filter(({ score }) => Number.isFinite(score))
        .sort((a, b) => {
        if (b.score !== a.score)
            return b.score - a.score;
        return a.index - b.index;
    });
    return ranked[0]?.target;
}
function scoreCDPTarget(target, preferredPattern) {
    if (!target.webSocketDebuggerUrl)
        return Number.NEGATIVE_INFINITY;
    const type = (target.type ?? '').toLowerCase();
    const url = (target.url ?? '').toLowerCase();
    const title = (target.title ?? '').toLowerCase();
    const haystack = `${title} ${url}`;
    if (!haystack.trim() && !type)
        return Number.NEGATIVE_INFINITY;
    if (haystack.includes('devtools'))
        return Number.NEGATIVE_INFINITY;
    let score = 0;
    if (preferredPattern && preferredPattern.test(haystack))
        score += 1000;
    if (type === 'app')
        score += 120;
    else if (type === 'webview')
        score += 100;
    else if (type === 'page')
        score += 80;
    else if (type === 'iframe')
        score += 20;
    if (url.startsWith('http://localhost') || url.startsWith('https://localhost'))
        score += 90;
    if (url.startsWith('file://'))
        score += 60;
    if (url.startsWith('http://127.0.0.1') || url.startsWith('https://127.0.0.1'))
        score += 50;
    if (url.startsWith('about:blank'))
        score -= 120;
    if (url === '' || url === 'about:blank')
        score -= 40;
    if (title && title !== 'devtools')
        score += 25;
    if (title.includes('antigravity'))
        score += 120;
    if (title.includes('codex'))
        score += 120;
    if (title.includes('cursor'))
        score += 120;
    if (title.includes('chatwise'))
        score += 120;
    if (title.includes('notion'))
        score += 120;
    if (title.includes('discord'))
        score += 120;
    if (title.includes('netease'))
        score += 120;
    if (url.includes('antigravity'))
        score += 100;
    if (url.includes('codex'))
        score += 100;
    if (url.includes('cursor'))
        score += 100;
    if (url.includes('chatwise'))
        score += 100;
    if (url.includes('notion'))
        score += 100;
    if (url.includes('discord'))
        score += 100;
    if (url.includes('netease'))
        score += 100;
    return score;
}
function compilePreferredPattern(raw) {
    const value = raw?.trim();
    if (!value)
        return undefined;
    return new RegExp(escapeRegExp(value.toLowerCase()));
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export const __test__ = {
    selectCDPTarget,
    scoreCDPTarget,
};
