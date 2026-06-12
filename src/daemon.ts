/**
 * opencli micro-daemon — HTTP + WebSocket bridge between CLI and Chrome Extension.
 *
 * Architecture:
 *   CLI → HTTP POST /command → daemon → WebSocket → Extension
 *   Extension → WebSocket result → daemon → HTTP response → CLI
 *
 * Lifecycle:
 *   - Auto-spawned by opencli on first browser command
 *   - Auto-exits after 5 minutes of idle
 *   - Listens on localhost:19825
 *
 * Security:
 *   - Token-based authentication for all /command requests
 *   - Rate limiting on /command endpoint
 *   - Error message sanitization
 *   - 1MB request body size limit
 *   - WebSocket hijacking prevention (single extension)
 */

import * as crypto from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = parseInt(process.env.OPENCLI_DAEMON_PORT ?? '19825', 10);
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutos
const MAX_BODY_SIZE = 1024 * 1024; // 1MB request body limit

// ─── Token-based authentication ───────────────────────────────────────────

const DAEMON_TOKEN = crypto.randomBytes(32).toString('hex');
// Print token to stderr so the spawning process (BrowserBridge) can capture it
console.error(`[daemon] TOKEN:${DAEMON_TOKEN}`);

function isValidToken(req: IncomingMessage): boolean {
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  // timingSafeEqual requires both buffers to have the same length
  if (token.length !== DAEMON_TOKEN.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(token, 'utf-8'),
    Buffer.from(DAEMON_TOKEN, 'utf-8'),
  );
}

// ─── Rate limiting ──────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW = 60_000; // 1 minute window
const RATE_LIMIT_MAX = 120; // max commands per window
const commandCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = commandCounts.get(ip);
  if (!entry || now >= entry.resetAt) {
    commandCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// Periodic cleanup of stale rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of commandCounts) {
    if (now >= entry.resetAt) commandCounts.delete(ip);
  }
}, RATE_LIMIT_WINDOW);

// ─── State ───────────────────────────────────────────────────────────

let extensionWs: WebSocket | null = null;
const pending = new Map<string, {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}>();
let idleTimer: ReturnType<typeof setTimeout> | null = null;

// Extension log ring buffer
interface LogEntry { level: string; msg: string; ts: number; }
const LOG_BUFFER_SIZE = 200;
const logBuffer: LogEntry[] = [];

function pushLog(entry: LogEntry): void {
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();
}

// ─── Idle auto-exit ──────────────────────────────────────────────────

function resetIdleTimer(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    console.error('[daemon] Idle timeout, shutting down');
    process.exit(0);
  }, IDLE_TIMEOUT);
}

// ─── Error sanitization ─────────────────────────────────────────────

/** Sanitize error messages to prevent information leakage */
function sanitizeError(err: unknown, isRequestError: boolean = false): string {
  if (err instanceof Error) {
    if (err.message.includes('timeout')) return 'Request timed out';
    if (isRequestError) return 'Invalid request';
    return err.message.replace(/at\s+.*/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
  }
  return 'An internal error occurred';
}

// ─── HTTP Server ─────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalLength = 0;
    req.on('data', (c: Buffer) => {
      totalLength += c.length;
      if (totalLength > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Request body too large'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function jsonResponse(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function getClientIP(req: IncomingMessage): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || 'unknown';
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url ?? '/';
  const pathname = url.split('?')[0];
  const ip = getClientIP(req);

  // ── Public endpoints (no auth required) ────────────────────────────

  if (req.method === 'GET' && pathname === '/status') {
    jsonResponse(res, 200, {
      ok: true,
      extensionConnected: extensionWs?.readyState === WebSocket.OPEN,
      pending: pending.size,
    });
    return;
  }

  // ── Token validation for all protected endpoints ───────────────────

  if (!isValidToken(req)) {
    jsonResponse(res, 401, { ok: false, error: 'Unauthorized — invalid or missing daemon token' });
    return;
  }

  // ── Protected endpoints ────────────────────────────────────────────

  if (req.method === 'GET' && pathname === '/logs') {
    const params = new URL(url, `http://localhost:${PORT}`).searchParams;
    const level = params.get('level');
    const filtered = level
      ? logBuffer.filter(e => e.level === level)
      : logBuffer;
    jsonResponse(res, 200, { ok: true, logs: filtered });
    return;
  }

  if (req.method === 'DELETE' && pathname === '/logs') {
    logBuffer.length = 0;
    jsonResponse(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && url === '/command') {
    // Rate limiting
    if (!checkRateLimit(ip)) {
      jsonResponse(res, 429, { ok: false, error: 'Too many requests. Please slow down.' });
      return;
    }

    resetIdleTimer();
    try {
      const body = JSON.parse(await readBody(req));
      if (!body.id) {
        jsonResponse(res, 400, { ok: false, error: 'Missing command id' });
        return;
      }

      if (!extensionWs || extensionWs.readyState !== WebSocket.OPEN) {
        jsonResponse(res, 503, { id: body.id, ok: false, error: 'Extension not connected. Please install the opencli Browser Bridge extension.' });
        return;
      }

      const result = await new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(body.id);
          reject(new Error('Command timeout (120s)'));
        }, 120000);
        pending.set(body.id, { resolve, reject, timer });
        extensionWs!.send(JSON.stringify(body));
      });

      jsonResponse(res, 200, result);
    } catch (err) {
      const isTimeout = err instanceof Error && err.message.includes('timeout');
      const isBodyLarge = err instanceof Error && err.message.includes('too large');
      const status = isTimeout ? 408 : isBodyLarge ? 413 : 400;
      jsonResponse(res, status, {
        ok: false,
        error: sanitizeError(err, !isTimeout && !isBodyLarge),
      });
    }
    return;
  }

  jsonResponse(res, 404, { error: 'Not found' });
}

// ─── WebSocket for Extension ─────────────────────────────────────────

const httpServer = createServer((req, res) => { handleRequest(req, res).catch(() => { res.writeHead(500); res.end(); }); });
const wss = new WebSocketServer({ server: httpServer, path: '/ext' });

wss.on('connection', (ws) => {
  // SECURITY: Reject additional extension connections while one is already active.
  // This prevents a second (potentially malicious) extension from hijacking
  // commands by racing the connection.
  if (extensionWs && extensionWs.readyState === WebSocket.OPEN) {
    console.error('[daemon] Rejecting second extension connection (one already active)');
    ws.close(1008, 'Another extension is already connected');
    return;
  }
  console.error('[daemon] Extension connected');
  extensionWs = ws;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // Handle log messages from extension
      if (msg.type === 'log') {
        const prefix = msg.level === 'error' ? '❌' : msg.level === 'warn' ? '⚠️' : '📋';
        console.error(`${prefix} [ext] ${msg.msg}`);
        pushLog({ level: msg.level, msg: msg.msg, ts: msg.ts ?? Date.now() });
        return;
      }

      // Handle command results
      const p = pending.get(msg.id);
      if (p) {
        clearTimeout(p.timer);
        pending.delete(msg.id);
        p.resolve(msg);
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on('close', () => {
    console.error('[daemon] Extension disconnected');
    if (extensionWs === ws) {
      extensionWs = null;
      // Reject all pending requests since the extension is gone
      for (const [id, p] of pending) {
        clearTimeout(p.timer);
        p.reject(new Error('Extension disconnected'));
      }
      pending.clear();
    }
  });

  ws.on('error', () => {
    if (extensionWs === ws) extensionWs = null;
  });
});

// ─── Start ───────────────────────────────────────────────────────────

httpServer.listen(PORT, '127.0.0.1', () => {
  console.error(`[daemon] Listening on http://127.0.0.1:${PORT}`);
  resetIdleTimer();
});

httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[daemon] Port ${PORT} already in use — another daemon is likely running. Exiting.`);
    process.exit(0);
  }
  console.error('[daemon] Server error:', err.message);
  process.exit(1);
});

// Graceful shutdown
function shutdown(): void {
  // Reject all pending requests so CLI doesn't hang
  for (const [, p] of pending) {
    clearTimeout(p.timer);
    p.reject(new Error('Daemon shutting down'));
  }
  pending.clear();
  if (extensionWs) extensionWs.close();
  httpServer.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
