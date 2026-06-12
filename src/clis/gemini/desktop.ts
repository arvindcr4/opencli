/**
 * Gemini MacOS Desktop App — common helpers.
 *
 * Uses AppleScript for app activation + Accessibility API (Swift) for
 * reading/switching the model picker. Text is injected via the clipboard.
 *
 * Requires: macOS Accessibility permission for the calling terminal.
 */

import { execFileSync, execSync, spawnSync } from 'node:child_process';

/** Google Gemini MacOS app bundle identifier. */
export const GEMINI_BUNDLE_ID = 'com.google.Gemini';

/** Activate the Gemini MacOS app and bring it to the front. */
export function activateGemini(): void {
  execSync(`osascript -e 'tell application id "${GEMINI_BUNDLE_ID}" to activate'`);
  execSync("osascript -e 'delay 0.4'");
}

/** Returns true if the Gemini MacOS app is currently running. */
export function isGeminiRunning(): boolean {
  try {
    const output = execFileSync('osascript', [
      '-e',
      `tell application "System Events" to (name of processes) contains "Gemini"`,
    ], { encoding: 'utf-8' });
    return output.trim() === 'true';
  } catch {
    return false;
  }
}

/** Copy `text` to the macOS clipboard and paste it into the focused Gemini window. */
export function pasteAndSubmitToGemini(text: string): void {
  let clipboardBackup = '';
  try {
    clipboardBackup = execSync('pbpaste', { encoding: 'utf-8' });
  } catch {
    clipboardBackup = '';
  }

  try {
    spawnSync('pbcopy', { input: text });
    execSync(
      "osascript " +
      "-e 'tell application \"System Events\"' " +
      "-e 'keystroke \"v\" using command down' " +
      "-e 'delay 0.2' " +
      "-e 'keystroke return' " +
      "-e 'end tell'",
    );
  } finally {
    spawnSync('pbcopy', { input: clipboardBackup });
  }
}

/**
 * Press a key combination in the focused Gemini window without touching the clipboard.
 * Useful for "new conversation" (Cmd+N) and other shortcuts.
 *
 * SECURITY: The keyCombo is interpolated into an AppleScript string and
 * passed to osascript. This function must ONLY be called with hardcoded
 * values — never with user input. To enforce that, only allow key combos
 * matching a strict whitelist of modifier+key pairs.
 */
const ALLOWED_KEYCOMBOS = new Set([
  'n using command down',
  'w using command down',
  'q using command down',
  'a using command down',
  'r using command down',
  'k using command down',
  'f using command down',
  'p using command down',
  's using command down',
  'delete',
  'return',
  'tab',
  'escape',
  'up', 'down', 'left', 'right',
]);

export function pressGeminiShortcut(keyCombo: string): void {
  if (!ALLOWED_KEYCOMBOS.has(keyCombo)) {
    throw new Error(`pressGeminiShortcut: keyCombo '${keyCombo}' is not in the allowed list. ` +
      `This function only accepts hardcoded key combinations to prevent osascript injection.`);
  }
  execSync(
    "osascript " +
    "-e 'tell application \"System Events\"' " +
    `-e 'keystroke "${keyCombo}"' ` +
    "-e 'end tell'",
  );
}

/** Start a new conversation in Gemini (Cmd+N or in-app button). */
export function newGeminiConversation(): void {
  activateGemini();
  pressGeminiShortcut('n using command down');
}

/**
 * Read the currently visible chat text from the focused Gemini window using
 * the macOS Accessibility tree. Returns "" if no readable window is found.
 */
export function getVisibleGeminiText(): string[] {
  const AX_READ_SCRIPT = `
import Cocoa
import ApplicationServices

func attr(_ el: AXUIElement, _ name: String) -> AnyObject? {
    var value: CFTypeRef?
    guard AXUIElementCopyAttributeValue(el, name as CFString, &value) == .success else { return nil }
    return value as AnyObject?
}

func s(_ el: AXUIElement, _ name: String) -> String? {
    if let v = attr(el, name) as? String, !v.isEmpty { return v }
    return nil
}

func children(_ el: AXUIElement) -> [AXUIElement] {
    (attr(el, kAXChildrenAttribute as String) as? [AnyObject] ?? []).map { $0 as! AXUIElement }
}

func collectTexts(_ el: AXUIElement, into out: inout [String]) {
    let role = s(el, kAXRoleAttribute as String) ?? ""
    if role == kAXStaticTextRole as String {
        if let text = s(el, kAXDescriptionAttribute as String), !text.isEmpty {
            out.append(text)
        }
    }
    for c in children(el) {
        collectTexts(c, into: &out)
    }
}

guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: "${GEMINI_BUNDLE_ID}").first else {
    fputs("Gemini is not running\\n", stderr)
    exit(1)
}

let axApp = AXUIElementCreateApplication(app.processIdentifier)
guard let win = attr(axApp, kAXFocusedWindowAttribute as String) as! AXUIElement? else {
    fputs("No focused Gemini window\\n", stderr)
    exit(1)
}

var texts: [String] = []
collectTexts(win, into: &texts)
print(texts.joined(separator: "\\n"))
`;

  try {
    const out = execFileSync('swift', ['-'], {
      input: AX_READ_SCRIPT,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    }).trim();
    if (!out) return [];
    return out.split('\n').map(s => s.replace(/[\\uFFFC\\u200B-\\u200D\\uFEFF]/g, '').trim()).filter(s => s.length > 0);
  } catch {
    return [];
  }
}
