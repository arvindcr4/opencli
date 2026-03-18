/**
 * Browser connection error classification and formatting.
 */



export type ConnectFailureKind = 'extension-timeout' | 'extension-not-installed' | 'mcp-init' | 'process-exit' | 'unknown';

export type ConnectFailureInput = {
  kind: ConnectFailureKind;
  timeout: number;
  stderr?: string;
  exitCode?: number | null;
  rawMessage?: string;
};

export function formatBrowserConnectError(input: ConnectFailureInput): Error {
  const stderr = input.stderr?.trim();
  const suffix = stderr ? `\n\nMCP stderr:\n${stderr}` : '';

  if (input.kind === 'extension-not-installed') {
    return new Error(
      'Failed to connect to OpenCLI MCP Bridge: the browser extension did not attach.\n\n' +
      'Make sure Chrome is running and the "OpenCLI MCP Bridge" extension is installed and enabled in Developer Mode.' +
      suffix,
    );
  }

  if (input.kind === 'extension-timeout') {
    return new Error(
      `Timed out connecting to OpenCLI MCP Bridge (${input.timeout}s).\n\n` +
      `Make sure Chrome is running with the OpenCLI MCP Bridge extension enabled.` +
      suffix,
    );
  }

  if (input.kind === 'mcp-init') {
    return new Error(`Failed to initialize OpenCLI MCP: ${input.rawMessage ?? 'unknown error'}${suffix}`);
  }

  if (input.kind === 'process-exit') {
    return new Error(
      `OpenCLI MCP process exited before the browser connection was established${input.exitCode == null ? '' : ` (code ${input.exitCode})`}.` +
      suffix,
    );
  }

  return new Error(input.rawMessage ?? 'Failed to connect to browser');
}

export function inferConnectFailureKind(args: {
  stderr: string;
  rawMessage?: string;
  exited?: boolean;
}): ConnectFailureKind {
  const haystack = `${args.rawMessage ?? ''}\n${args.stderr}`.toLowerCase();

  if (haystack.includes('extension connection timeout') || haystack.includes('opencli mcp bridge') || haystack.includes('playwright mcp bridge'))
    return 'extension-not-installed';
  if (args.rawMessage?.startsWith('MCP init failed:'))
    return 'mcp-init';
  if (args.exited)
    return 'process-exit';
  return 'extension-timeout';
}
