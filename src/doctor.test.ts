import { describe, expect, it } from 'vitest';
import {
  readTokenFromShellContent,
  renderBrowserDoctorReport,
} from './doctor.js';

describe('shell token helpers', () => {
  it('reads token from shell export', () => {
    expect(readTokenFromShellContent('export PLAYWRIGHT_MCP_EXTENSION_TOKEN="abc123"\n')).toBe('abc123');
  });
});

describe('doctor report rendering', () => {
  const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

  it('renders OK-style report when tokens match', () => {
    const text = strip(renderBrowserDoctorReport({
      envToken: 'abc123',
      extensionToken: 'abc123',
      extensionInstalled: true,
      extensionBrowsers: ['Chrome'],
      shellFiles: [{ path: '/tmp/.zshrc', exists: true, token: 'abc123' }],
      configs: [{ path: '/tmp/mcp.json', exists: true, format: 'json', token: 'abc123', writable: true }],
      recommendedToken: 'abc123',
      warnings: [],
      issues: [],
    }));

    expect(text).toContain('[OK] Extension installed (Chrome)');
    expect(text).toContain('[OK] Environment token: configured');
    expect(text).toContain('[OK] /tmp/mcp.json');
    expect(text).toContain('configured');
  });

  it('renders MISSING-style report when components are not installed', () => {
    const text = strip(renderBrowserDoctorReport({
      envToken: 'abc123',
      extensionToken: null,
      extensionInstalled: false,
      extensionBrowsers: [],
      shellFiles: [{ path: '/tmp/.zshrc', exists: true, token: 'def456' }],
      configs: [{ path: '/tmp/mcp.json', exists: true, format: 'json', token: 'abc123', writable: true }],
      recommendedToken: 'abc123',
      warnings: [],
      issues: [],
    }));

    expect(text).toContain('[MISSING] Extension not installed in any browser');
    expect(text).toContain('[OK] Environment token: configured');
    expect(text).toContain('[OK] /tmp/.zshrc');
    expect(text).toContain('configured');
    expect(text).toContain('[OK] Token Configuration: Not required for OpenCLI MCP');
  });

  it('renders connectivity OK when live test succeeds', () => {
    const text = strip(renderBrowserDoctorReport({
      envToken: 'abc123',
      extensionToken: 'abc123',
      extensionInstalled: true,
      extensionBrowsers: ['Chrome'],
      shellFiles: [],
      configs: [],
      recommendedToken: 'abc123',
      connectivity: { ok: true, durationMs: 1234 },
      warnings: [],
      issues: [],
    }));

    expect(text).toContain('[OK] Browser connectivity: connected in 1.2s');
  });

  it('renders connectivity WARN when not tested', () => {
    const text = strip(renderBrowserDoctorReport({
      envToken: 'abc123',
      extensionToken: 'abc123',
      extensionInstalled: true,
      extensionBrowsers: ['Chrome'],
      shellFiles: [],
      configs: [],
      recommendedToken: 'abc123',
      warnings: [],
      issues: [],
    }));

    expect(text).toContain('[WARN] Browser connectivity: not tested (use --live)');
  });
});

