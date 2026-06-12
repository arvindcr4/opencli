/**
 * HTTP client for communicating with the opencli daemon.
 *
 * Provides a typed send() function that posts a Command and returns a Result.
 *
 * Security: All requests include a bearer token for daemon authentication.
 */

const DAEMON_PORT = parseInt(process.env.OPENCLI_DAEMON_PORT ?? '19825', 10);
const DAEMON_URL = `http://127.0.0.1:${DAEMON_PORT}`;

let _idCounter = 0;

function generateId(): string {
  return `cmd_${Date.now()}_${++_idCounter}`;
}

/** Daemon auth token, set by BrowserBridge after spawning the daemon */
let _daemonToken: string | undefined;

/** Set the daemon token (called by BrowserBridge after spawning) */
export function setDaemonToken(token: string): void {
  _daemonToken = token;
}

/** Get current daemon token */
export function getDaemonToken(): string | undefined {
  return _daemonToken ?? undefined;
}

/** Create headers with daemon auth token if available */
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (_daemonToken) {
    headers['Authorization'] = `Bearer ${_daemonToken}`;
  }
  return headers;
}

export interface DaemonCommand {
  id: string;
  action: 'exec' | 'navigate' | 'tabs' | 'cookies' | 'screenshot' | 'close-window';
  tabId?: number;
  code?: string;
  url?: string;
  op?: string;
  index?: number;
  domain?: string;
  format?: 'png' | 'jpeg';
  quality?: number;
  fullPage?: boolean;
}

export interface DaemonResult {
  id: string;
  ok: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Check if daemon is running.
 */
export async function isDaemonRunning(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${DAEMON_URL}/status`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Check if daemon is running AND the extension is connected.
 */
export async function isExtensionConnected(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${DAEMON_URL}/status`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const data = await res.json() as { extensionConnected?: boolean };
    return !!data.extensionConnected;
  } catch {
    return false;
  }
}

/**
 * Send a command to the daemon and wait for a result.
 * Retries up to 3 times with 500ms delay for transient failures.
 */
export async function sendCommand(
  action: DaemonCommand['action'],
  params: Omit<DaemonCommand, 'id' | 'action'> = {},
): Promise<unknown> {
  const id = generateId();
  const command: DaemonCommand = { id, action, ...params };
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(`${DAEMON_URL}/command`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(command),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const result = (await res.json()) as DaemonResult;

      if (!result.ok) {
        throw new Error(result.error ?? 'Daemon command failed');
      }

      return result.data;
    } catch (err) {
      const isRetryable = err instanceof TypeError  // fetch network error
        || (err instanceof Error && err.name === 'AbortError');
      if (isRetryable && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      throw err;
    }
  }
  // Unreachable — the loop always returns or throws
  throw new Error('sendCommand: max retries exhausted');
}
