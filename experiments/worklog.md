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

### Run 2: 11 new chatgpt commands — feature_count=18 (KEEP)
- Timestamp: 2026-03-20
- What changed: conversations, history, wait, stop, switch, goto, share, projects, image, upload, poll
- Result: 18 features, 0 typecheck errors
- Insight: CDPBridge import path is ../../browser/cdp.js not ../browser/cdp.js (2 levels up from clis/chatgpt/)
- Next: expand to gemini, grok, claude

### Run 3: full AI control suite — feature_count=42 (KEEP)
- Timestamp: 2026-03-20
- What changed: Added gemini (6), claude (8), grok more commands (5); chatgpt search/memory/export/rename/poll
- Result: 42 features, 0 typecheck errors, 500% improvement over baseline
- Insight: All 4 major AI assistants now have core control: ask/read/history/wait/stop
- Next: add conversations to gemini/grok, promode equivalent for Gemini Advanced/Ultra

### Key Insights (updated)
- CDPBridge path: ../../browser/cdp.js (from clis/{site}/)
- isGenerating() pattern works: check for stop button data-testid or text "stop"
- Gemini DOM: model-response, user-query elements; stop has aria-label
- Claude DOM: [data-message-author-role], [data-is-streaming="true"]
- Grok DOM: .message-bubble, div.message-bubble; stop button text-based
- build-manifest auto-scans all .ts files in clis/* — new commands auto-register
- Utility ax.ts files are excluded from feature_count metric

### Next Ideas
- gemini/conversations — list gem conversations from sidebar
- gemini/switch — switch to Advanced/1.5 Pro/etc.
- grok/think — use reasoning/think mode
- grok/conversations — list conversations
- claude/upload — upload file to claude.ai
- claude/export — export claude conversation
- chatgpt/promode: add --model flag to pick o4-mini/o3/o3-pro from CLI
- Improve chatgpt/ask: add isThinking guard like promode for better stability

### Run 6: +29 symmetry commands across all 4 sites — feature_count=84 (KEEP)
- Timestamp: 2026-03-20 10:56
- What changed: Added missing commands to Gemini (send/poll/rename/share/goto/upload/image/search/promode), Claude (send/poll/rename/share/goto/search/memory), Grok (send/switch/poll/rename/share/goto/upload/image/search), ChatGPT (gpts/archive/restore/models)
- Result: 84 features, +53% vs prev best 55, +1100% vs baseline 7
- Insight: Big gaps existed in Gemini/Claude/Grok — missing all the control/navigation commands. Adding symmetry across all sites creates a much more powerful toolkit. The pattern is clear: every site needs ask/send/poll/new/read/export/conversations/history/rename/share/goto/search/stop/wait to be fully controllable.
- Next: Add site-specific advanced commands: ChatGPT voice/canvas, Claude artifacts, Grok xai/feed, Gemini gems/workspace. Also add cross-site batch operations.

### Key Insights
1. Command symmetry across sites is valuable — users can apply same mental model to all 4 AI systems
2. Every site needs at minimum: ask/send/poll/new/read/export/conversations/history/stop/wait for full control
3. file_format vs format naming is critical — global -f/--format conflict must be avoided
4. CDPBridge creates isolated tabs via PUT /json/new — old binary doesn't isolate tabs causing race conditions
5. promode/deepresearch/research commands need long timeouts (3600s) as AI thinks for extended periods
6. stableCount >= 2-3 + min length prevents premature completion detection

### Next Ideas
- ChatGPT: voice command (start/stop voice chat), canvas (edit artifact), feedback (thumbs up/down)
- Claude: artifacts (view/export), notes (project notes)
- Gemini: gems (custom AI modes), workspace (Google Workspace integration)
- Grok: xai (xAI-specific features), feed (Twitter/X context)
- Cross-site: batch-ask (same question to all 4 AI), compare (compare responses)
