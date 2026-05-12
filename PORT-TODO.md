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
| chatgpt promode | 125a3553 / 677b5a4c / 0841f92e | **no** | needs rework |
| chatgpt ask/send/read/new/status/ax tweaks | 0841f92e | **no** | needs review |
| CDP isolated tab per session | 56f8e8a8 | **no** | needs rework |
| Gemini CLI commands | 3481396c | obsolete | upstream has clis/gemini/ now |
| ChatGPT desktop model switching | e36b11ba | obsolete | upstream has clis/chatgpt-app/model.js |
| feishu adapter mods | 0841f92e | dropped | upstream removed feishu |
| wechat adapter mods | 0841f92e | dropped | upstream removed wechat |

## Why promode + CDP isolated tabs were deferred

The fork's `promode` and `cdp` work depend on raw CDP bridge access:

```ts
const cdpBridge = (page as any).bridge;
await cdpBridge.send('Input.dispatchMouseEvent', ...);
await cdpBridge.send('DOM.setFileInputFiles', ...);
```

Upstream's `IPage` interface (`src/types.ts`) does not expose a `bridge`
property. The fork's commit `56f8e8a8 feat(cdp): isolated tab per session`
modified the page class to expose it, but upstream has since refactored
the browser layer (workspaces → sessions, see `9c06e84c`,
`467fdd0b`, `0e168d57`) and the patch no longer applies.

To port promode properly you'll need to either:

1. **Add a sanctioned `bridge` accessor to upstream's page class** (most
   work; may require an upstream contribution), or
2. **Replace CDP raw calls with higher-level page methods** —
   `page.setFileInput(absPaths, '#upload-files')` already covers the file
   upload case (see `clis/chatgpt/utils.js#uploadChatGPTImages`). For the
   model-selector Radix dropdown, switch from CDP mouse events to
   `page.snapshot` + `page.click` semantic-ref clicks.

Skeleton for option 2 lives in the legacy tag at
`legacy-main-2026-05-12:src/clis/chatgpt/promode.ts` — read it side-by-side
with `clis/chatgpt/utils.js#uploadChatGPTImages` and `isGenerating` to
see the upstream equivalents.

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
