# Autoresearch Dashboard: chatgpt-control

**Runs:** 5 | **Kept:** 5 | **Discarded:** 0 | **Crashed:** 0
**Baseline:** feature_count: 7 features (#1)
**Best:** feature_count: 55 features (#5, +686%)

| # | commit | feature_count | typecheck_errors | status | description |
|---|--------|---------------|-----------------|--------|-------------|
| 1 | 90f8404 | 7 | 0 | keep | baseline: chatgpt ask/deepresearch/new/promode/read/send/status |
| 2 | 7c2dfee | 18 (+157%) | 0 | keep | chatgpt: +conversations, history, wait, stop, switch, goto, share, projects, image, upload, poll |
| 3 | eebdab5 | 42 (+500%) | 0 | keep | full AI suite: gemini/claude/grok skeleton + chatgpt search/memory/export/rename |
| 4 | a6c5e24 | 51 (+629%) | 0 | keep | gemini deepresearch/conversations/switch + claude research/upload/export + grok research/think/conversations |
| 5 | 55a40de | 55 (+686%) | 0 | keep | grok/new + claude/switch + gemini+grok export — symmetry complete |

## Commands by Site (55 total commands, ax utility files excluded)

### ChatGPT (chatgpt.com) — 22 commands
ask, conversations, deepresearch, export, goto, history, image, memory, new, poll, promode, projects, read, rename, search, send, share, status, stop, switch, upload, wait

### Gemini (gemini.google.com) — 9 commands
ask, conversations, deepresearch, export, history, new, read, stop, switch, wait

### Claude.ai (claude.ai) — 11 commands
ask, conversations, export, history, new, projects, read, research, stop, switch, upload, wait

### Grok (grok.com) — 10 commands (+1 ax)
ask, conversations, deepsearch, export, history, new, read, research, stop, think, wait
