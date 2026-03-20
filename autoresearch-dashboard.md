# Autoresearch Dashboard: chatgpt-control

**Runs:** 10 | **Kept:** 10 | **Discarded:** 0 | **Crashed:** 0
**Baseline:** feature_count: 7 features (#1)
**Best:** feature_count: 124 features (#10, +1671%)

| # | commit | feature_count | typecheck_errors | status | description |
|---|--------|---------------|-----------------|--------|-------------|
| 1 | 90f8404 | 7 | 0 | keep | baseline: chatgpt ask/deepresearch/new/promode/read/send/status |
| 2 | 7c2dfee | 18 (+157%) | 0 | keep | chatgpt: +conversations, history, wait, stop, switch, goto, share, projects, image, upload, poll |
| 3 | eebdab5 | 42 (+500%) | 0 | keep | full AI suite: gemini/claude/grok skeleton + chatgpt search/memory/export/rename |
| 4 | a6c5e24 | 51 (+629%) | 0 | keep | gemini deepresearch/conversations/switch + claude research/upload/export + grok research/think/conversations |
| 5 | 55a40de | 55 (+686%) | 0 | keep | grok/new + claude/switch + gemini+grok export — 55 total AI commands |
| 6 | 897577c | 84 (+1100%) | 0 | keep | +29: gemini/claude/grok/chatgpt missing symmetry commands |
| 7 | 7b053c2 | 100 (+1328%) | 0 | keep | delete/regenerate/feedback for all sites + canvas/artifacts/extensions/xai |
| 8 | b1b7c53 | 106 (+1414%) | 0 | keep | status for all sites, gems/extensions, voice/custom_instructions for chatgpt |
| 9 | 1d8f10e | 115 (+1542%) | 0 | keep | archive/restore/models for gemini/claude/grok |
| 10 | 275693e | 124 (+1671%) | 0 | keep | memory/canvas/image/voice + grounding/extended_thinking |

## Commands by Site (124 total)

### ChatGPT — 32 commands
archive, ask, canvas, conversations, custom_instructions, deepresearch, delete, export, feedback, goto, gpts, history, image, memory, models, new, poll, promode, projects, read, regenerate, rename, restore, search, send, share, status, stop, switch, upload, voice, wait

### Gemini — 31 commands  
archive, ask, canvas, conversations, deepresearch, delete, export, extensions, feedback, gems, goto, grounding, history, image, memory, models, new, poll, promode, read, regenerate, rename, restore, search, send, share, status, stop, switch, upload, wait

### Claude — 32 commands
archive, artifacts, ask, canvas, conversations, delete, export, extended_thinking, feedback, goto, history, image, memory, models, new, poll, projects, read, regenerate, rename, research, restore, search, send, share, status, stop, switch, upload, wait

### Grok — 29 commands
archive, ask, conversations, deepsearch, delete, export, feedback, goto, history, image, memory, models, new, poll, projects, read, regenerate, rename, research, restore, search, send, share, status, stop, switch, think, upload, voice, wait, xai
