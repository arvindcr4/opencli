# Gemini (MacOS Desktop App)

Control the **Google Gemini MacOS Desktop App** directly from the terminal.
OpenCLI supports the desktop app through AppleScript automation, in the same
way as the Chatgpt adapter.

## Prerequisites

1. Install the official Google Gemini MacOS Desktop App.
2. Grant **Accessibility permissions** to your terminal app in
   **System Settings → Privacy & Security → Accessibility**.

## Commands

| Command | Description |
|---------|-------------|
| `opencli gemini app-status` | Check if the Gemini MacOS app is currently running. |
| `opencli gemini app-new` | Activate Gemini and press `Cmd+N` to start a new conversation. |
| `opencli gemini app-send "message"` | Copy your message to the clipboard, activate Gemini, paste, and submit. |
| `opencli gemini app-read` | Read the latest visible chat content from the focused Gemini window via the Accessibility tree. |
| `opencli gemini app-ask "message"` | Send the prompt and read back the response (polls until the text stabilises). |

## How It Works

- **AppleScript mode** is the default. It uses `osascript` to activate the
  Gemini app, `pbcopy`/`pbpaste` to paste prompts, and the macOS
  Accessibility tree (via a Swift one-shot) to read the visible chat text.
- The Gemini MacOS bundle identifier is `com.google.Gemini`. The adapter
  activates it by bundle id, which is robust against the user having
  renamed the app.

## Limitations

- macOS only (AppleScript + Accessibility dependency)
- AppleScript mode requires **Accessibility permissions** for the calling
  terminal app
- `app-read` returns the visible static text in the focused Gemini
  window — scroll first if the message you want is not visible
- `app-ask` uses a simple "text stable for two consecutive polls"
  heuristic. It is not as reliable as the web version's network-based
  detection; if you need high-confidence turn detection, prefer the
  web adapter (`opencli gemini ask`).

## Examples

```bash
# Check the app is running
opencli gemini app-status

# Start a fresh conversation
opencli gemini app-new

# Send a single message
opencli gemini app-send "Explain TCP three-way handshake"

# Read what's currently on screen
opencli gemini app-read

# Send and wait for the response (up to 60s by default)
opencli gemini app-ask "What's the capital of France?"

# Custom timeout
opencli gemini app-ask "Write a haiku about recursion" --timeout 120
```
