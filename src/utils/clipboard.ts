/**
 * Cross-platform clipboard utilities.
 * macOS: pbpaste / pbcopy
 * Linux: xclip (falls back to xsel if xclip unavailable)
 */
import { execSync, spawnSync } from 'node:child_process';

function hasCmd(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function linuxPaste(): string {
  if (hasCmd('xclip')) {
    return execSync('xclip -selection clipboard -o', { encoding: 'utf-8' });
  } else if (hasCmd('xsel')) {
    return execSync('xsel --clipboard --output', { encoding: 'utf-8' });
  }
  throw new Error('No clipboard tool found. Install xclip: sudo dnf install xclip');
}

function linuxCopy(text: string): void {
  if (hasCmd('xclip')) {
    spawnSync('xclip', ['-selection', 'clipboard'], { input: text });
  } else if (hasCmd('xsel')) {
    spawnSync('xsel', ['--clipboard', '--input'], { input: text });
  } else {
    throw new Error('No clipboard tool found. Install xclip: sudo dnf install xclip');
  }
}

export function clipRead(): string {
  if (process.platform === 'darwin') {
    return execSync('pbpaste', { encoding: 'utf-8' });
  }
  return linuxPaste();
}

export function clipWrite(text: string): void {
  if (process.platform === 'darwin') {
    spawnSync('pbcopy', { input: text });
  } else {
    linuxCopy(text);
  }
}
