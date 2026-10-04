# Story 178 — RD-1.1 Colour tokens v2 (light)

**Objective:** apply the approved light palette (`00-overview.md` §2.2) through the existing token layer so every screen re-skins with zero screen edits.

**Current implementation:** `packages/config/tailwind-tokens.css` holds RGB-channel tokens; `--accent` is slate-900, `--focus` blue-700, `--info` blue, `--warning-solid` amber-600 (3.19:1 as an icon), `--danger-solid-hover` red-500 (3.76:1 with white text), `--ink-subtle` slate-500 (4.34:1 on `surface-muted`). Form controls border with `--rule-strong` (1.48:1). An unmapped shadcn alias block (`--primary`, …) has 0 consumers.

**Files:** `packages/config/tailwind-tokens.css`, `packages/config/tailwind-preset.js`, `packages/ui/src/lib/color.ts` (+ spec), `packages/ui/src/index.ts`, `apps/web/src/test/token-contrast.spec.ts`.

**Approach:** change values in place (names unchanged, so `bg-accent` etc. re-skin); add `surface-raised`, `rule-control`, `accent-active` and the `progress` family to tokens and preset; delete the alias block; add WCAG maths (`color.ts`) and a guard spec that parses the real light `:root` block and asserts every §2.2 pair.

**Acceptance criteria:**
- [x] Indigo accent, indigo focus, sky info, amber-700 warning solid, red-700 danger hover, `#5E6B80` ink-subtle.
- [x] New tokens available as `bg-surface-raised`, `border-rule-control`, `bg-accent-active`, `*-progress-*`.
- [x] Every §2.2 light pair meets its ratio (40 assertions).
- [x] 0 references to the removed aliases.

**Verification:** `@crm/ui` 32 files / 317 tests; `@crm/web` 89 / 1330 (one transient failure of `design-tokens.spec.ts` under parallel load, green in isolation and on a full re-run); ui + web typecheck and lint clean; visual before/after (dashboard, tickets, ticket, login, portal home/ticket × 320/1280 × en/ar, light): only colour changed, no layout shift, no overflow.

**Non-goals:** dark values (RD-1.4), adopting `rule-control`/`surface-raised` in primitives (RD-1.8–1.10), screen edits.
