# design-system-token-foundation — plan overview

Entry point for the **design-system-token-foundation** feature. Stories execute in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 134 | [134-story-extend-the-design-token-layer-beyond-colour.md](./134-story-extend-the-design-token-layer-beyond-colour.md) | Extend the design token layer beyond colour | _(none — intake entered manually via `--no-tracker`)_ | Story S-1 / DS-1a / DS-1b (`packages/config/tailwind-tokens.css` + `tailwind-preset.js`), Story 129 (shell, untouched) |

## Dependency notes

- **This feature is the foundation of the UI/UX redesign sequence, and Story 134 is its first and currently only story.** It was approved from a UI/UX reconnaissance at commit `2f7aec5` as **DS-A**. Story 134 blocks the rest of that sequence — DS-B (adopt the unused `Card`/`Textarea` primitives), DS-C (portal adopts `Alert` + danger tokens), DS-D (standardise list loading/error/empty state), DS-E (consolidate cross-app presentational duplicates) — because each of those needs a vocabulary to spend rather than a fresh per-file judgement call.

- **Story 134 is deliberately invisible.** It adds names for values the codebase already uses; it does not apply them. That is what makes it the safe first unit: defining tokens changes no markup, so it cannot regress authentication, permissions, realtime behaviour, or RTL correctness — the four high-risk areas the recon identified. A rendered screen before and after Story 134 must be identical, and the plan requires that to be **proven by a compiled-CSS diff rather than asserted**.

- **It extends the existing mechanism; it must not create a second one.** `packages/config/tailwind-tokens.css` holds the 55 semantic colour tokens and `packages/config/tailwind-preset.js` exports the shared `theme.extend` object that both apps spread into their own Tailwind config. Story 134 adds `spacing`, `borderRadius` and `boxShadow` alongside the existing `colors` / `fontFamily` / `fontSize`. The preset's own header (~lines 14–30) records why it is **not** consumed via Tailwind's `presets` key — that key *replaces* Tailwind's default preset and would silently drop its default scales. Any new key must obey the same additive contract: every existing `p-4`, `gap-2`, `rounded-md` must resolve exactly as it does today.

- **A correction the plan carries, and later stories should inherit.** The recon reported "no typography tokens." That was wrong. A named 7-step type scale (`caption`, `label`, `body-sm`, `body`, `subhead`, `heading`, `title`) already exists at `tailwind-preset.js` ~lines 139–147 with **zero usages** in either app or `packages/ui`. It is not missing — it is unadopted, exactly as that file's own comment intends ("applying them is a shared `PageHeader`'s job"). **Story 134 therefore does not redefine typography**; it documents the existing scale so it is discoverable, and leaves adoption to its own later story. Introducing a competing scale would be precisely the drift this feature exists to prevent.

- **Two constraints inherited from earlier decisions, binding on every story here.** The radius block's comment (`tailwind-tokens.css` ~lines 130–136) records that Tailwind's `rounded-md` was deliberately left alone because it is already used 149 times and remapping it "would have been a silent visual change across the whole app for no gain" — so radius work is additive naming only. And `--accent` is deliberately **not** wired to a branch's branding `primaryColor` (deferred by that file's own comment and re-affirmed by Story 129); connecting it would recolour every button from an admin-supplied hex with real contrast risk, and belongs to no story in this feature.

- **Dark mode is not part of this feature.** The token file has no `prefers-color-scheme` / `.dark` / `data-theme` handling today. Dark mode needs the full non-colour vocabulary to exist first plus a genuine contrast pass, so it sits last in the recon's sequence (DS-F), not here.
