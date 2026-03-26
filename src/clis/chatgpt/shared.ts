import { execFileSync, execSync, spawnSync } from 'node:child_process';

export const CHATGPT_MODEL_CHOICES = ['auto', 'instant', 'thinking', 'pro', 'legacy'] as const;

type ChatGptModelAlias = {
  canonical: string;
  terms: string[];
};

const CHATGPT_MODEL_ALIASES: ChatGptModelAlias[] = [
  { canonical: 'auto', terms: ['auto', 'automatic'] },
  { canonical: 'instant', terms: ['instant', 'fast'] },
  {
    canonical: 'thinking',
    terms: [
      'thinking',
      'think',
      '5.4 thinking',
      'gpt 5.4 thinking',
      'gpt 5 thinking',
      'gpt-5-thinking',
      'gpt-5.4-thinking',
    ],
  },
  {
    canonical: 'pro',
    terms: [
      'pro',
      'pro model',
      'research grade',
      'research-grade',
      'research grade intelligence',
      'gpt 5 pro',
      'gpt-5-pro',
      'gpt5pro',
      '5.4 pro',
      'gpt 5.4 pro',
    ],
  },
  {
    canonical: 'legacy models',
    terms: ['legacy', 'legacy model', 'legacy models'],
  },
];

type ChatGptModelRuntimeResult = {
  status: 'Active' | 'Already active' | 'Switched' | 'NotFound' | 'Error';
  active?: string;
  matched?: string;
  available?: string[];
  error?: string;
};

export function normalizeChatGptModelText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function buildChatGptModelSearchTerms(input: string): string[] {
  const normalized = normalizeChatGptModelText(input);
  if (!normalized) return [];

  const terms = new Set<string>([normalized]);

  for (const alias of CHATGPT_MODEL_ALIASES) {
    const canonical = normalizeChatGptModelText(alias.canonical);
    const aliasTerms = alias.terms.map(normalizeChatGptModelText);
    const matchesAlias =
      normalized === canonical ||
      aliasTerms.includes(normalized) ||
      aliasTerms.some(term => normalized.includes(term) || term.includes(normalized)) ||
      canonical.includes(normalized) ||
      normalized.includes(canonical);

    if (!matchesAlias) continue;

    terms.add(canonical);
    for (const term of aliasTerms) terms.add(term);
  }

  return [...terms];
}

export type ChatGptModelOption = {
  title: string;
  description?: string;
};

export function findMatchingChatGptModelOption(
  options: ChatGptModelOption[],
  desiredModel: string,
): ChatGptModelOption | null {
  const searchTerms = buildChatGptModelSearchTerms(desiredModel);
  if (searchTerms.length === 0) return null;

  const normalizedOptions = options.map(option => ({
    option,
    title: normalizeChatGptModelText(option.title),
    combined: normalizeChatGptModelText(`${option.title} ${option.description ?? ''}`),
  }));

  for (const searchTerm of searchTerms) {
    const exact = normalizedOptions.find(candidate => candidate.title === searchTerm);
    if (exact) return exact.option;
  }

  for (const searchTerm of searchTerms) {
    const prefix = normalizedOptions.find(
      candidate =>
        candidate.title.startsWith(searchTerm) ||
        searchTerm.startsWith(candidate.title),
    );
    if (prefix) return prefix.option;
  }

  for (const searchTerm of searchTerms) {
    const contains = normalizedOptions.find(candidate => candidate.combined.includes(searchTerm));
    if (contains) return contains.option;
  }

  return null;
}

export function activateChatGpt(): void {
  execSync("osascript -e 'tell application \"ChatGPT\" to activate'");
  execSync("osascript -e 'delay 0.5'");
}

export function pasteAndSubmitToChatGpt(text: string): void {
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

function runChatGptModelScript(desiredModel?: string): ChatGptModelRuntimeResult {
  const targetTerms = desiredModel ? buildChatGptModelSearchTerms(desiredModel) : [];
  const swiftSource = `
import Cocoa
import ApplicationServices

func attr(_ element: AXUIElement, _ name: String) -> AnyObject? {
    var value: CFTypeRef?
    let result = AXUIElementCopyAttributeValue(element, name as CFString, &value)
    guard result == .success else { return nil }
    return value as AnyObject?
}

func stringAttr(_ element: AXUIElement, _ name: String) -> String {
    if let value = attr(element, name) as? String { return value }
    return ""
}

func childElements(_ element: AXUIElement) -> [AXUIElement] {
    guard let raw = attr(element, kAXChildrenAttribute as String) as? [AnyObject] else { return [] }
    var result: [AXUIElement] = []
    for item in raw {
        result.append(unsafeBitCast(item, to: AXUIElement.self))
    }
    return result
}

func normalize(_ text: String) -> String {
    var output = ""
    var lastWasSpace = false
    for scalar in text.lowercased().unicodeScalars {
        let isAlphaNumeric = CharacterSet.alphanumerics.contains(scalar)
        if isAlphaNumeric {
            output.unicodeScalars.append(scalar)
            lastWasSpace = false
        } else if !lastWasSpace {
            output.append(" ")
            lastWasSpace = true
        }
    }
    return output.trimmingCharacters(in: .whitespacesAndNewlines)
}

func jsonString(_ object: Any) -> String {
    let data = try! JSONSerialization.data(withJSONObject: object, options: [])
    return String(data: data, encoding: .utf8)!
}

func findModelButton(in element: AXUIElement) -> AXUIElement? {
    let role = stringAttr(element, kAXRoleAttribute as String)
    let title = stringAttr(element, kAXTitleAttribute as String)
    let description = stringAttr(element, kAXDescriptionAttribute as String)
    let help = stringAttr(element, kAXHelpAttribute as String)
    if role == kAXButtonRole as String && (
        title == "Options" ||
        description == "Options" ||
        description.contains("Pick a model or GPT") ||
        help.contains("Pick a model or GPT")
    ) {
        return element
    }
    for child in childElements(element) {
        if let found = findModelButton(in: child) {
            return found
        }
    }
    return nil
}

func findPopover(in element: AXUIElement) -> AXUIElement? {
    let role = stringAttr(element, kAXRoleAttribute as String)
    if role == "AXPopover" {
        return element
    }
    for child in childElements(element) {
        if let found = findPopover(in: child) {
            return found
        }
    }
    return nil
}

func collectButtons(in element: AXUIElement, into buttons: inout [AXUIElement]) {
    let role = stringAttr(element, kAXRoleAttribute as String)
    if role == kAXButtonRole as String {
        buttons.append(element)
    }
    for child in childElements(element) {
        collectButtons(in: child, into: &buttons)
    }
}

func currentModel(from button: AXUIElement) -> String {
    let value = stringAttr(button, kAXValueAttribute as String)
    if !value.isEmpty { return value }
    return stringAttr(button, kAXTitleAttribute as String)
}

let targetTerms: [String] = ${JSON.stringify(targetTerms)}

guard let app = NSRunningApplication.runningApplications(withBundleIdentifier: "com.openai.chat").first else {
    print(jsonString(["status": "Error", "error": "ChatGPT is not running"]))
    exit(0)
}

let axApp = AXUIElementCreateApplication(app.processIdentifier)
guard let windowsRaw = attr(axApp, kAXWindowsAttribute as String) as? [AnyObject], !windowsRaw.isEmpty else {
    print(jsonString(["status": "Error", "error": "No ChatGPT windows are open"]))
    exit(0)
}

let windows = windowsRaw.map { unsafeBitCast($0, to: AXUIElement.self) }
let modelButton = windows.compactMap { findModelButton(in: $0) }.first
guard let modelButton else {
    print(jsonString(["status": "Error", "error": "Could not find the ChatGPT model picker"]))
    exit(0)
}

let activeModel = currentModel(from: modelButton)
if targetTerms.isEmpty {
    print(jsonString(["status": "Active", "active": activeModel]))
    exit(0)
}

let normalizedActiveModel = normalize(activeModel)
let alreadyActive = targetTerms.contains { term in
    normalizedActiveModel == term ||
    normalizedActiveModel.contains(term) ||
    term.contains(normalizedActiveModel)
}

if alreadyActive {
    print(jsonString(["status": "Already active", "active": activeModel]))
    exit(0)
}

if findPopover(in: modelButton) == nil {
    let pressResult = AXUIElementPerformAction(modelButton, kAXPressAction as CFString)
    if pressResult != .success {
        print(jsonString(["status": "Error", "error": "Failed to open the ChatGPT model picker"]))
        exit(0)
    }
    Thread.sleep(forTimeInterval: 0.25)
}

guard let popover = findPopover(in: modelButton) else {
    print(jsonString(["status": "Error", "error": "ChatGPT opened no model popover"]))
    exit(0)
}

var buttons: [AXUIElement] = []
collectButtons(in: popover, into: &buttons)

let options = buttons.compactMap { button -> (AXUIElement, String, String)? in
    let description = stringAttr(button, kAXDescriptionAttribute as String)
    let title = stringAttr(button, kAXTitleAttribute as String)
    let fallbackTitle = description.split(separator: ",", maxSplits: 1, omittingEmptySubsequences: true).first.map(String.init) ?? description
    let resolvedTitle = title.isEmpty ? fallbackTitle : title
    if resolvedTitle.isEmpty { return nil }
    return (button, resolvedTitle, description)
}

func score(for title: String, description: String) -> Int {
    let normalizedTitle = normalize(title)
    let normalizedCombined = normalize(title + " " + description)

    for term in targetTerms {
        if normalizedTitle == term { return 300 }
    }
    for term in targetTerms {
        if normalizedTitle.hasPrefix(term) || term.hasPrefix(normalizedTitle) { return 200 }
    }
    for term in targetTerms {
        if normalizedCombined.contains(term) { return 100 }
    }
    return 0
}

let ranked = options
    .map { (button, title, description) in (button, title, description, score(for: title, description: description)) }
    .filter { $0.3 > 0 }
    .sorted { lhs, rhs in
        if lhs.3 != rhs.3 { return lhs.3 > rhs.3 }
        return lhs.1 < rhs.1
    }

guard let matched = ranked.first else {
    let available = options.map { $0.1 }
    _ = AXUIElementPerformAction(modelButton, kAXPressAction as CFString)
    print(jsonString([
        "status": "NotFound",
        "active": activeModel,
        "available": available,
    ]))
    exit(0)
}

let clickResult = AXUIElementPerformAction(matched.0, kAXPressAction as CFString)
if clickResult != .success {
    print(jsonString(["status": "Error", "error": "Failed to select model \\(matched.1)"]))
    exit(0)
}

Thread.sleep(forTimeInterval: 0.3)
let newActiveModel = currentModel(from: modelButton)
print(jsonString([
    "status": "Switched",
    "matched": matched.1,
    "active": newActiveModel,
]))
`;

  const raw = execFileSync('swift', ['-'], {
    input: swiftSource,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  }).trim();

  if (!raw) {
    return { status: 'Error', error: 'Empty response from ChatGPT model inspector' };
  }

  return JSON.parse(raw) as ChatGptModelRuntimeResult;
}

export function getActiveChatGptModel(): string {
  activateChatGpt();
  const result = runChatGptModelScript();

  if (result.status === 'Error') {
    throw new Error(result.error ?? 'Failed to read the active ChatGPT model');
  }

  return result.active ?? 'Unknown';
}

export function switchChatGptModel(desiredModel: string): ChatGptModelRuntimeResult {
  activateChatGpt();
  const result = runChatGptModelScript(desiredModel);

  if (result.status === 'NotFound') {
    const available = result.available?.join(', ') ?? 'unknown';
    throw new Error(`Model "${desiredModel}" not found. Available options: ${available}`);
  }

  if (result.status === 'Error') {
    throw new Error(result.error ?? `Failed to switch ChatGPT model to "${desiredModel}"`);
  }

  return result;
}
