# Story 180 — RD-1.3 Remove raw palette leaks and add the style guard

**Objective:** make colour token-only before dark mode lands (`00-overview.md` RD-1.3), and keep it that way with a guard.

**Current implementation (recon VL-10, A11Y-12):** raw palette classes at 7 sites — `text-emerald-600` (users, customer detail; ≈3.8:1, fails AA at `text-xs`), `text-amber-700` (reports), `border-red-200` (web notification toaster), `text-red-700` (portal chat), `emerald-300/50/700` (portal notification preferences), `text-white` (Button destructive). `text-danger-solid` used as text in 3 places — 3.70:1 on the dark surface. Only slate/white had a guard (`design-tokens.spec.ts`).

**Files:** the 9 component files above + 2 specs that asserted the old class, `packages/config/tailwind-{tokens.css,preset.js}` (`danger-solid-foreground`), new `apps/web/src/test/style-guard.spec.ts`.

**Approach:** swap each leak for its semantic token (success/warning/danger foreground, `danger-border`, the success subtle/border set); add `danger-solid-foreground` for text on the destructive fill. One guard spec scans production `.ts/.tsx` in apps/web, apps/portal and packages/ui (comments and specs excluded) for raw palette classes, physical-direction utilities, `dark:` outside packages/ui, and `*-solid` steps used as text (independent QA finding QA-05; one icon-only allow-list entry), with fixture tests proving each pattern flags and accepts what it should.

**Acceptance criteria:**
- [x] 0 raw palette classes, 0 physical-direction utilities, 0 `dark:` in apps.
- [x] `text-danger-solid` no longer used for text.
- [x] Guard fixtures flag violations and accept logical/semantic equivalents (including prose such as "right-aligned").

**Verification:** ui 329 · portal 430 · web 1363 tests; typecheck + lint clean in all three. Visual: class swaps are same-meaning token substitutions (tone changes only on three small status texts); covered by the RD-1.4 light/dark sweep.

**Non-goals:** dark values (RD-1.4); broader adoption sweeps (Phase 7).
