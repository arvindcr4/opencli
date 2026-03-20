# Autoresearch Worklog: opencli ChatGPT Control

**Goal**: Maximize opencli ChatGPT feature surface — every new working command = +1 metric.
**Branch**: autoresearch/chatgpt-control-2026-03-20
**Started**: 2026-03-20

---

## Session 1 — 2026-03-20

### Baseline
- Commands: ask, deepresearch, new, promode, read, send, status (7 total, ax.ts is utility)
- All compile clean.

### Key Insights
- `ax.ts` is utility — excluded from count
- CDPBridge.connect() creates isolated tab — new commands can use it for clean context
- `selectChatGPTMode(bridge, mode)` in promode.ts can be reused for `switch.ts`
- `isGenerating(page)` pattern can be reused in wait/stop commands
- DOM selectors that work on chatgpt.com:
  - Messages: `[data-message-author-role]`
  - Stop button: `[data-testid="stop-button"]`
  - Conversations: `nav a[href*="/c/"]`
  - Projects: sidebar links with `/g/` pattern
  - Share: button with share icon / aria-label

### Next Ideas
- conversations, history, wait, stop, switch, image, projects, share, goto, upload
- Improve `ask.ts`: add isThinking guard from promode (prevents premature capture)
- Improve `read.ts`: add --all flag to show all messages
- Add `poll.ts`: return when generation completes + return result (combines wait + read)
- Add `search.ts`: use ChatGPT web search mode
- Add `canvas.ts`: open canvas editing mode
