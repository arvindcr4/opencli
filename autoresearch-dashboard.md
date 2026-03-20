# Autoresearch Dashboard: chatgpt-control

**Runs:** 6 | **Kept:** 6 | **Discarded:** 0 | **Crashed:** 0
**Baseline:** feature_count: 7 features (#1)
**Best:** feature_count: 84 features (#6, +1100%)

| # | commit | feature_count | typecheck_errors | status | description |
|---|--------|---------------|-----------------|--------|-------------|
| 1 | 90f8404 | 7 | 0 | keep | baseline: chatgpt ask/deepresearch/new/promode/read/send/status |
| 2 | 7c2dfee | 18 (+157%) | 0 | keep | chatgpt: +conversations, history, wait, stop, switch, goto, share, projects, image, upload, poll |
| 3 | eebdab5 | 42 (+500%) | 0 | keep | full AI suite: gemini/claude/grok skeleton + chatgpt search/memory/export/rename |
| 4 | a6c5e24 | 51 (+629%) | 0 | keep | gemini deepresearch/conversations/switch + claude research/upload/export + grok research/think/conversations |
| 5 | 55a40de | 55 (+686%) | 0 | keep | grok/new + claude/switch + gemini+grok export — 55 total AI commands |
| 6 | 897577c | 84 (+1100%) | 0 | keep | +29: gemini/claude/grok/chatgpt missing symmetry commands |

## Commands by Site (84 total commands, ax utility files excluded)

### ChatGPT (chatgpt.com) — 26 commands
archive, ask, conversations, deepresearch, export, goto, gpts, history, image, memory, models, new, poll, promode, projects, read, rename, restore, search, send, share, status, stop, switch, upload, wait

### Gemini (gemini.google.com) — 19 commands
ask, conversations, deepresearch, export, goto, history, image, new, poll, promode, read, rename, search, send, share, stop, switch, upload, wait

### Claude (claude.ai) — 19 commands
ask, conversations, export, goto, history, memory, new, poll, projects, read, rename, research, search, send, share, stop, switch, upload, wait

### Grok (grok.com) — 20 commands
ask, conversations, deepsearch, export, goto, history, image, new, poll, read, rename, research, search, send, share, stop, switch, think, upload, wait
