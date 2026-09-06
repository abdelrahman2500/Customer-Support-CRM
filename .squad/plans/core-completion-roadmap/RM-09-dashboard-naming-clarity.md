# RM-09 — Dashboard/Reports Naming &amp; Metric-Mode Clarity

**Priority:** P2 · **Complexity:** Small · **Blocked:** No · **Phase:** 2 (Reporting)

## Goal

Resolve two small, disclosed clarity gaps: (1) "Dashboard" currently names
two unrelated things in this product, and (2) the Agent Performance report
silently changes meaning depending on whether a date filter is active, with
no UI cue.

## Why it exists

- The Agent Dashboard (`dashboard-view.tsx`, a live ticket queue) and the
  Reporting module's "Saved Dashboards" feature (Story 110) share the word
  "dashboard" and nothing else — independently computed, from different
  services, with no link between the two screens. This is a naming/product-
  clarity issue, not a functional bug, but worth a small, low-risk fix.
- `getAgentPerformance`'s own doc comment already discloses: with no date
  filter, it's a live workload snapshot (open + resolved counts as of now);
  with a filter applied, it becomes a created-in-range outcome breakdown —
  the same widget answering a different question with no visual
  distinction in `reports-view.tsx`.

## Dependencies

Sequenced last in Phase 2, after `RM-07`/`RM-08` settle the reporting UI's
final shape — a polish pass on top, not a prerequisite for either.

## Backend work

None.

## Frontend work

- Rename the internal/product-facing label for the Reporting module's
  "Saved Dashboards" feature to something that doesn't collide with "Agent
  Dashboard" in user-facing copy (e.g. "Report Views" or "Saved Views" —
  decide the exact wording with attention to existing translation keys;
  requires updating both `en.json`/`ar.json` message files, not just the
  English label).
- Add a small, explicit mode indicator on the Agent Performance widget
  (e.g. a caption reading "Live snapshot" vs. "Created in range" depending
  on whether a date filter is active) so the two meanings are never
  ambiguous to whoever is reading it.

## Worker/realtime work

None.

## Schema/migration work

None.

## Tests

- `reports-view.spec.tsx` — extend to assert the mode caption switches
  correctly with/without an active date filter.
- Any snapshot/text-matching test referencing the old "dashboard" label for
  Saved Dashboards updated to match the new copy.

## Acceptance criteria

- No user-facing string calls both the Agent Dashboard and Reporting's
  saved-views feature "dashboard."
- The Agent Performance widget visibly indicates which of its two modes is
  currently active.
- Both Arabic and English translations are updated, not just English.

## Definition of Done

- All acceptance criteria verified.
- `pnpm --filter @crm/web test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`
  pass.
- One dedicated commit, pushed.
