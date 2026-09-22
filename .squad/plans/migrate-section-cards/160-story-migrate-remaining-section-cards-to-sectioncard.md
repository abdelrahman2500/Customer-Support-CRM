# Story 160 — Migrate remaining section cards to `SectionCard` and guard the pattern

---

## Prerequisites

- **Story 154** — `SectionCard`, and `CardTitle`'s `as` prop that gives it a heading level.
- **Story 139** — the `Card` adoption guard in each app's `design-tokens.spec.ts`, whose shape this story's new guard follows.
- **Stories 155, 159** — the two partial adoptions so far (three admin list views; the KB version-history panel).

---

## Story Goal

Finish `SectionCard`'s adoption, and close it with a guard so the composition
cannot be hand-written again.

**Not in scope:** any redesign, any `Card` visual change, `QueryStateCard`,
navigation/ticket/customer/KB redesign, dark mode, backend, API, permissions.

---

## Premise, measured at HEAD `4edfca9`

A source scan classified every `<Card>` in `apps/web/src` and `apps/portal/src`
that carries `p-surface` or is immediately followed by an `<h2>`:

| Bucket | Count |
|---|---|
| **Exact pattern** — `<Card … p-surface>` whose first meaningful child is `<h2 className="text-sm font-semibold text-ink">` | **31** (web 26, portal 5) |
| Not this pattern — skeleton placeholders, KPI tiles, `PageHeader` wrappers, `asChild` `<form>`/`<section>` surfaces, metadata grids | 25 |

The 31 are uniform. There is exactly one structural variation:
`dashboard-view.tsx:305` carries `elevation="raised"`, which `SectionCard`
already accepts. None has an action in its heading row, a conditional heading,
a `key`, a custom `className` beyond `p-surface`, or any other prop.

### The full site list

`apps/web`: `admin/branding-view.tsx:247`, `api-keys/api-keys-view.tsx:218`,
`attachments/attachments-card.tsx:60`,
`automation-rules/automation-rules-view.tsx:335`,
`branches/branch-departments-view.tsx:174`,
`business-hours/business-hours-view.tsx:178,214,420`,
`dashboard/dashboard-view.tsx:305,389`, `dashboard/tasks-panel.tsx:66`,
`notifications/notification-preferences-section.tsx:33`,
`quick-replies/quick-replies-view.tsx:186`,
`roles/role-list-view.tsx:310,362`,
`settings/change-password-section.tsx:97`,
`tickets/customer-context-panel.tsx:66`, `tickets/ticket-ai-card.tsx:88`,
`tickets/ticket-chat-card.tsx:78`,
`tickets/ticket-detail-view.tsx:399,642,710,743,771`,
`tickets/ticket-kb-references-card.tsx:47`,
`webhook-subscriptions/webhook-subscriptions-view.tsx:409`.

`apps/portal`: `chat/chat-widget.tsx:96`,
`portal/change-password-section.tsx:72`,
`portal/notification-preferences-section.tsx:36`,
`tickets/ticket-attachments-card.tsx:39`, `tickets/ticket-chat-card.tsx:49`.

---

## Design decisions

### 1 — The migration is DOM-identical, and that is the verification strategy

```tsx
// Before
<Card className="p-surface">
  <h2 className="text-sm font-semibold text-ink">{title}</h2>
  {children}
</Card>

// After
<SectionCard title={title}>
  {children}
</SectionCard>
```

`Card` and `SectionCard` both default to `elevation="flat"`; `SectionCard`
composes `cn("p-surface", className)` onto the same `Card`; its default
`headingLevel` is `"h2"`; `CardTitle` renders exactly
`className="text-sm font-semibold text-ink"`. The rendered markup is
byte-identical.

So **the existing web and portal suites passing unchanged is the proof**. No
test is rewritten to accommodate this story, and any spec that does start
failing is evidence the migration was not equivalent at that site — to be fixed
in the component, never in the assertion.

### 2 — All 31, or the story does not work

The guard is the point of the story, and a guard cannot be written while
known-violating sites remain. A partial migration would leave either no guard,
or a guard carrying an exemption list of sites nobody decided to keep — which is
worse than the duplication it replaces, because it makes the exceptions look
deliberate.

### 3 — `SectionCard`'s API is not extended

Every site is representable today. Widening a primitive to absorb an awkward
call site is how a shared component stops being shared, and nothing here forces
the question.

### 4 — The guard matches the pair, not `Card`

The anti-pattern is two adjacent lines, so a single-line regex like Story 139's
cannot express it. The guard finds a `<Card …>` opening whose `className`
contains `p-surface`, then looks at the next meaningful line (skipping blanks
and JSX comments) for the canonical heading. Both halves must match.

That is what keeps the 25 legitimate `p-surface` Cards out of it: a skeleton, a
KPI tile, a `PageHeader` wrapper and an `asChild` `<form>` all carry
`p-surface`, and none is followed by that heading. Matching `Card` alone, or
`p-surface` alone, would flag every one of them.

---

## Frontend Tasks

No backend changes required.

### 1 — Migrate the 26 web sites

For each: replace the `Card` opening + `h2` with `<SectionCard title={…}>`, and
the matching `</Card>` with `</SectionCard>`. Pass `elevation="raised"` through
at `dashboard-view.tsx:305`. Add `SectionCard` to the file's `@crm/ui` import
and drop `Card` where the file no longer uses it. Children untouched.

### 2 — Migrate the 5 portal sites

Identical treatment.

### 3 — Guard in `apps/web/src/design-tokens.spec.ts`

A new `it(...)` inside the existing `describe`, reusing that file's
`collectSourceFiles`, its comment-skip convention and its
`offenders`/`expect([])` shape. Failure message: `Use <SectionCard> instead:`.

### 4 — Guard in `apps/portal/src/design-tokens.spec.ts`

The same guard, kept parallel rather than shared — the reason is already written
in that file's own header, and this story does not relitigate it.

---

## Edge Cases & Failure Modes

- **A `Card` that stops being used** once its only section becomes a
  `SectionCard`. Leaving the import triggers `no-unused-vars` in lint; lint is
  a gate here, so it is caught.
- **`elevation="raised"` silently dropped** at `dashboard-view.tsx:305`, which
  would remove the one intentional emphasis on the dashboard. Passed through
  explicitly and called out in review of the diff.
- **A spec that asserts on the container's class string** rather than on roles
  or text. The DOM is identical, so such a spec still passes; if one fails, the
  migration was wrong at that site.
- **Guard false positives.** The 25 non-section `p-surface` Cards are the test:
  the guard must report zero offenders at the end of the migration, and its own
  focused spec pins that the pair — not either half — is what it matches.
- **Guard false negatives.** A hand-written copy whose `Card` tag spans several
  lines, or which puts a JSX comment between the `Card` and its heading, must
  still be caught; the scan collects the whole opening tag and skips comments.

---

## Test Plan

1. **The existing suites, unchanged.** `@crm/web`, `@crm/portal` and `@crm/ui`
   must pass at their current counts. This is the primary evidence.
2. **Guard, web** — reports zero offenders across the real source tree.
3. **Guard, portal** — same.
4. **Guard sensitivity** — a focused spec proves the guard matches the
   `Card p-surface` + canonical-`h2` pair, and does **not** match either half
   alone (a `p-surface` Card followed by a `PageHeader`, a `Skeleton` or a
   `<form>`; a canonical `h2` not inside a `p-surface` Card).
5. **Heading levels** — every migrated section still exposes its heading at
   level 2, which the apps' existing `getByRole("heading", { level: 2 })`
   assertions already check.

---

## Verification Steps

1. `pnpm --filter @crm/web test` — baseline **1204**.
2. `pnpm --filter @crm/portal test` — re-establish the baseline before changing anything.
3. `pnpm --filter @crm/ui test` — baseline **252**.
4. `pnpm typecheck`, `pnpm lint`, `pnpm build`.
5. Re-run the classification scan: the exact-pattern count must be **0**, and
   the 25 non-section Cards must still be present and untouched.
6. `git status --short` + full diff: only `apps/web/src`, `apps/portal/src` and
   the two spec files. No backend, no `packages/ui`, no generated artifact.

---

## Done Criteria

- [ ] All 31 sites render through `SectionCard`; scan reports 0 remaining.
- [ ] `elevation="raised"` preserved at `dashboard-view.tsx:305`.
- [ ] The 25 non-section `Card` usages are untouched.
- [ ] No child, heading text, heading level, layout, spacing or token changed.
- [ ] `SectionCard`'s API unchanged.
- [ ] Both guards added, both reporting zero, with focused sensitivity coverage.
- [ ] web / portal / ui suites, typecheck, lint, build all green, **no test weakened**.
- [ ] No physical-direction utility, no raw palette class, no backend change.
