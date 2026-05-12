# Microsoft 365 Copilot

**Mode**: 🔐 Browser · **Domain**: `m365.cloud.microsoft`

Enterprise Copilot at https://m365.cloud.microsoft/chat (and the sibling
hosts `copilot.cloud.microsoft` / `www.office.com/chat`). The adapter uses
two interaction modes:

1. **DOM injection** (`chat` / `send` / `send-prompt` / `new` / `attach`) —
   targets the Fluent UI surface and depends on selectors Microsoft changes
   frequently.
2. **Substrate REST API** (`status` / `list-chats` / `read` / `get-chat`) —
   calls `https://substrate.office.com/m365Copilot/*` directly using the
   MSAL bearer token decrypted from the page's LocalStorage cache.

The token-decryption logic is ported from
[ganyuke/copilot-exporter](https://github.com/ganyuke/copilot-exporter)
(MIT), which itself ports MSAL crypto from
[`microsoft-authentication-library-for-js`](https://github.com/AzureAD/microsoft-authentication-library-for-js)
(MIT, Microsoft).

## Commands

| Command | Description |
|---------|-------------|
| `opencli copilot365 status` | Verify the active Chrome tab is logged in to Microsoft 365 Copilot |
| `opencli copilot365 new` | Start a new chat in Microsoft 365 Copilot |
| `opencli copilot365 send <text>` | Fire-and-forget: send a message without waiting for the reply |
| `opencli copilot365 send-prompt --file <path>` | Send a prompt loaded from a file (alias of `send --file`) |
| `opencli copilot365 chat <prompt>` | Send a prompt and wait for the reply |
| `opencli copilot365 read` | Read the currently-open chat (API first, DOM fallback) |
| `opencli copilot365 list-chats` | List recent chats via the substrate API |
| `opencli copilot365 get-chat <id>` | Fetch a specific conversation by id via the substrate API |
| `opencli copilot365 attach <file>` | Attach a local file to the current chat |

## Usage Examples

```bash
# Confirm the active Chrome tab is signed in
opencli copilot365 status

# Quick prompt and wait for the answer
opencli copilot365 chat "Summarize the linked SharePoint doc in 3 bullets"

# Fire-and-forget send; useful in pipelines
opencli copilot365 send "Reminder: ship update by EOW"

# Send a prompt from a file
opencli copilot365 send-prompt --file ./prompts/weekly-status.txt

# Read the currently-open conversation
opencli copilot365 read --turns 20 -f json

# List recent chats and fetch one
opencli copilot365 list-chats --limit 25
opencli copilot365 get-chat <conversation-id>

# Attach a local file (max 50 MB)
opencli copilot365 attach ./report.pdf
opencli copilot365 attach ./data.csv --mime text/csv
```

## Options

### `chat`

| Option | Description |
|--------|-------------|
| `prompt` | Prompt to send (required positional) |
| `--timeout` | Max seconds to wait for a reply (default: `120`) |

### `send`

| Option | Description |
|--------|-------------|
| `text` | Message text (or use `--file`) |
| `--file` | Read the prompt body from a file path |

### `read`

| Option | Description |
|--------|-------------|
| `--turns` | Max number of turns to return (default: `40`) |
| `--mode` | `api` (default) or `dom` |

### `list-chats`

| Option | Description |
|--------|-------------|
| `--limit` | Maximum chats to return, integer 1–200 (default: `25`). Invalid input is rejected, not silently clamped. |

### `get-chat`

| Option | Description |
|--------|-------------|
| `id` | Conversation id (positional, required) |
| `--turns` | Max turns to return (default: `40`) |

### `attach`

| Option | Description |
|--------|-------------|
| `file` | Path to local file (PDF / DOCX / XLSX / PPTX / TXT / CSV / PNG / JPG; <50 MB) |
| `--mime` | Override MIME type (auto-detected from extension by default) |

## Authentication

Sign in to `https://m365.cloud.microsoft/chat` in the active Chrome tab
(or whatever tab opencli is currently driving). `opencli copilot365 status`
will report `Connected` once the page has a hydrated `<div id="identity">`
JSON block with a tenant id, which the Substrate API mode relies on.

## Limitations

- DOM selectors are heuristic and may need updating after Microsoft Fluent
  UI rolls out changes. Open an issue if `chat` / `send` / `attach` start
  failing with selector-not-found errors.
- `attach` is capped at 50 MB (base64 expansion + bridge JSON ferrying);
  files >25 MB will print a warning.
- The Substrate REST mode requires a recent MSAL session in LocalStorage;
  if the page hasn't fully hydrated, fall back to DOM-mode commands.
