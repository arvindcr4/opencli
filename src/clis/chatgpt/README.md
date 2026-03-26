# ChatGPT Desktop Adapter for OpenCLI

Control the **ChatGPT macOS Desktop App** directly from the terminal. OpenCLI supports two automation approaches for ChatGPT.

## Approach 1: AppleScript (Default, No Setup)

The current built-in commands use native AppleScript automation — no extra launch flags needed.

### Prerequisites
1. Install the official [ChatGPT Desktop App](https://openai.com/chatgpt/mac/) from OpenAI.
2. Grant **Accessibility permissions** to your terminal app (Terminal / iTerm / Warp) in **System Settings → Privacy & Security → Accessibility**. This is required for System Events keystroke simulation.

### Commands
- `opencli chatgpt status`: Check if the ChatGPT app is currently running.
- `opencli chatgpt new`: Activate ChatGPT and press `Cmd+N` to start a new conversation.
- `opencli chatgpt model`: Read the currently active ChatGPT model/mode from the desktop app.
- `opencli chatgpt model pro`: Open the model picker and switch to `Pro`.
- `opencli chatgpt send "message"`: Copy your message to clipboard, activate ChatGPT, paste, and submit.
- `opencli chatgpt send "message" --model pro`: Switch models first, then send the message.
- `opencli chatgpt ask "message" --model pro`: Switch to `Pro`, send the prompt, wait, and read the response.
- `opencli chatgpt read`: Read the last visible message from the focused ChatGPT window via the Accessibility tree.

## Approach 2: CDP (Advanced, Electron Debug Mode)

ChatGPT Desktop is also an Electron app and can be launched with a remote debugging port for deeper automation via CDP:

```bash
/Applications/ChatGPT.app/Contents/MacOS/ChatGPT \
  --remote-debugging-port=9224
```

Then set the endpoint:
```bash
export OPENCLI_CDP_ENDPOINT="http://127.0.0.1:9224"
```

> **Note**: The CDP approach still enables future advanced commands like DOM inspection and code extraction. Model switching is now handled by the built-in Accessibility flow.

## How It Works

- **AppleScript mode**: Uses `osascript` to control ChatGPT, `pbcopy`/`pbpaste` to paste prompts, and the macOS Accessibility tree to read visible chat messages and switch the built-in model picker.
- **CDP mode**: Connects via Chrome DevTools Protocol to the Electron renderer process for direct DOM manipulation.

## Limitations

- macOS only (AppleScript dependency)
- AppleScript mode requires Accessibility permissions
- `read` returns the last visible message in the focused ChatGPT window — scroll first if the message you want is not visible
