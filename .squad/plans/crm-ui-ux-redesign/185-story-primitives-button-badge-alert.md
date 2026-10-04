# Story 185 — RD-1.8 Primitives A: Button, Badge, Alert

**Objective:** the design-language action, status and message primitives (`00-overview.md` §4.2), with no call-site migration required.

**Current implementation:**
- `Button`: 4 variants, 36/32/40px, `rounded-md`. No secondary, link or icon size.
- `Badge`: 7 variants, `rounded-full`. No size, no icon, no `progress` tone.
- `Alert`: default/destructive/success only (the tokens for warning/info existed unused), `rounded-md`. No icon or title.

**Files:** `packages/ui/src/components/{button,badge,alert}.tsx` (+ specs), `apps/portal/src/components/tickets/ticket-list-view.spec.tsx`.

**Approach:**
- `Button`: `rounded-control`, comfortable 40px default (sm 32, lg 44). New `secondary` (accent tint) and `link` variants, the latter kept text-only via a compound variant. `icon`/`icon-sm` square sizes. `active:` pressed states. Fast standard-eased transitions.
- `Badge`: `rounded-pill`, `progress` tone, `size` sm/md, and an optional decorative leading `icon`.
- `Alert`: `warning`/`info` variants (polite status), `rounded-control`, and opt-in `icon` (true = the variant's own) and `title`. When neither is passed the children render exactly as before, protecting ~100 call sites.

**Acceptance criteria:**
- [x] Existing variant names unchanged; no call-site edits needed.
- [x] New variants and sizes specced; Story 169's accessible-name-while-loading test still green.
- [x] No overflow at 320/768/1280 in en/ar, light/dark, with the larger controls.

**Verification:** ui 37 files / 386 · web 90 / 1414 · portal 48 / 430; typecheck + lint clean. Three specs follow token renames with unchanged intent (`rounded-full`→`rounded-pill`, `rounded-md`→`rounded-control`, `lg` `h-10`→`h-11`). Visual: 84 shots (login, dashboard, tickets, ticket, portal home/tickets × 320/768/1280 × en/ar × light/dark), 0 overflow.

**Non-goals:** form controls (RD-1.9, which brings inputs and selects to 40px); call-site adoption of `secondary`, `link` or icon buttons (surface Stories).
