# Fork-feature port TODO

Created 2026-05-12 alongside the `legacy-main → upstream` resync.

The fork's `main` was reset to `jackwener/OpenCLI@5127211e` on 2026-05-12.
The previous fork state is preserved at:

- `legacy-main-2026-05-12` — fork main tip (`2c0fa11c`) before the reset.
- `legacy-pr4-2026-05-12` — tip of the closed `arvindcr4/feat/copilot365-attach`
  branch (`52b8034c`, was PR #4).

Both tags live on `origin` and can be checked out with
`git fetch && git checkout legacy-main-2026-05-12`.

## Status

| Feature | Original commit | Ported? | Branch |
| --- | --- | --- | --- |
| copilot365 adapter (9 commands) | d056cc71 / 61ad7eaa | yes | port/fork-features-2026-05-12 |
| copilot365 attach | 6e66ba1a / 52b8034c (closed PR #4) | yes | same |
| chatgpt deepresearch | 125a3553 | yes | same |
| chatgpt promode | 125a3553 / 677b5a4c / 0841f92e | yes (rewritten on upstream API) | same — see notes |
| chatgpt ask/send/read/new/status/ax tweaks | 0841f92e | **no** | needs review |
| CDP isolated tab per session | 56f8e8a8 | **no** | needs rework |
| Gemini CLI commands | 3481396c | obsolete | upstream has clis/gemini/ now |
| ChatGPT desktop model switching | e36b11ba | obsolete | upstream has clis/chatgpt-app/model.js |
| feishu adapter mods | 0841f92e | dropped | upstream removed feishu |
| wechat adapter mods | 0841f92e | dropped | upstream removed wechat |

## promode notes (now ported, untested against live ChatGPT)

`clis/chatgpt/promode.js` was rewritten from the legacy
`src/clis/chatgpt/promode.ts` using upstream's higher-level page API
instead of the raw CDP bridge the fork relied on:

- `DOM.setFileInputFiles(...)` → `page.setFileInput([filePath], '#upload-files')`
- `Input.dispatchMouseEvent(...)` for the Radix model dropdown →
  `page.snapshot({interactive: true})` + `page.click(ref)` (real CDP click
  under the hood; should fire Radix open-handlers without the y-offset
  magic). Items are matched by their visible text against `MODE_MATCHERS`.
- Custom "is generating" / response-polling loop → upstream's
  `isGenerating` + a local `waitForProResponse` that requires 3 stable
  ticks and treats "Thinking…/Searching…/Reading…" headers as in-progress
  (Pro mode can pause for minutes between visible tokens).

**Untested against live ChatGPT.** Two specific risks to verify on first
real run:

1. The model-switcher dropdown trigger may not surface as a
   `data-testid="model-switcher-dropdown-button"` node in the snapshot.
   If `selectChatGPTMode` throws "Could not find ChatGPT model selector",
   inspect the snapshot output and adjust the lookup.
2. Menu-item names may not contain literal `pro` / `thinking` / `instant`
   substrings — Pro mode is sometimes labelled "Extended Pro" or
   `5.2-thinking`. Extend `MODE_MATCHERS` in `promode.js` as needed.

## CDP isolated tab per session — still deferred

Upstream replaced the workspaces concept with sessions
(commits `9c06e84c`, `467fdd0b`, `0e168d57`, `0e168d57`). The fork's
`56f8e8a8 feat(cdp): isolated tab per session` patch was written against
the workspaces layer and no longer applies. Re-implementing against the
new session model requires reading `src/browser/cdp.ts` end-to-end on
upstream and on `legacy-main-2026-05-12` side-by-side — not attempted
in this port.

## ChatGPT command tweaks (0841f92e)

That commit modified `src/clis/chatgpt/{ask,send,read,new,status,ax}.ts`
plus the (now-removed) feishu / wechat adapters, mostly to add a clipboard
fallback and tighten "generation in progress" detection. Compare against:

- `clis/chatgpt/utils.js#sendChatGPTMessage` (upstream's send pipeline)
- `clis/chatgpt/utils.js#isGenerating` (upstream's generation detector)

before re-applying any of the fork's logic — most of it is likely already
covered upstream.

## Recovery: how to bring back a deferred feature

```
git fetch origin --tags
git diff legacy-main-2026-05-12~5..legacy-main-2026-05-12 -- src/clis/chatgpt/promode.ts
# then re-implement on top of clis/chatgpt/ using upstream's page API
```
