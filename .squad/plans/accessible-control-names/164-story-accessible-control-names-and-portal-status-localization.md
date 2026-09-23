# Story 164 — Accessible control names and final portal ticket-status localization

---

## Prerequisites

- **Story 150** — `TableCell`'s `label` prop and the responsive table it serves.
- **Story 151** — `FormField`'s ARIA wiring, deliberately *not* used here (see decision 2).
- **Story 153** — the ticket label hooks and the `t("status.<VALUE>")` convention the portal already follows in two of three places.

---

## Story Goal

Give nine controls an accessible name, and stop showing one screen's customers
a raw enum. Accessibility and localization only.

**Not in scope:** the 9 early-return loading states, the 2
`ArticleDetailSkeleton` `aria-hidden` gaps, the 6 raw status-palette sites,
`FormField` adoption, navigation, tokens, backend, RBAC, new i18n keys.

---

## Premise, measured at HEAD `8e8a58c`

133 `Input`/`Textarea`/`SelectTrigger` renders scanned; **10** unnamed, of which
`reports-view.tsx:98` is a doc-comment false positive → **9 real**. Six sit
inside a `TableCell`; three are named only by an adjacent visual `<span>` or a
`placeholder`, neither of which is an accessible name.

Plus `portal/portal-home-view.tsx:148` rendering `{ticket.status}`.

---

## Design decisions

### 1 — Reuse the key that is already there

Every one of the nine has the right string at the call site: the six table
cases reuse the exact key their own `TableCell label=` is passed (Story 150's
"labels reuse each column's own header key", extended one step), and the other
three reuse the key of the adjacent span or placeholder. **Zero new i18n keys**,
so no parity risk and no invented copy. All nine confirmed present in EN and AR
before any edit.

### 2 — `aria-label`, not `FormField`

`FormField` renders a visible `<label>`. Inside a table cell that changes the
column's layout on every row — a visual redesign bought to fix a semantics bug.
`aria-label` changes the accessibility tree and nothing else, which is what an
accessibility-only story should do.

### 3 — Two guards, each narrow

**Cell controls:** scoped to a control inside a `<TableCell>`, which is exactly
where the mobile-label convention misleads. It accepts `aria-label`,
`aria-labelledby`, `id`, and a `label`/`Label`/`FormField` wrapper above — it is
not "every input needs `aria-label`". Probe against the tree: 12 controls inside
cells, **0** offenders after the fix. Added to both apps: the portal has no
editable cells today but renders through the same shared `TableCell`, so the
trap opens the moment it adds one.

**Raw enum:** matches an enum rendered as a JSX **child** — the only position
that becomes visible text — so it never flags the legitimate
`variant={ticketStatusBadgeVariant(ticket.status)}` on the same element. Portal
only, where the defect was, and not a general enum analyser.

---

## Frontend Tasks

No backend changes required.

1. Six `aria-label`s on inline-edit inputs inside table cells.
2. Three `aria-label`s on the password and note controls.
3. `portal-home-view` renders `tTickets(\`status.${ticket.status}\`)` — the hook already exists in that component.
4. Guard A in both apps' `design-tokens.spec.ts`; guard B in the portal's.

---

## Edge Cases & Failure Modes

- **A test that finds a control by display value.** Several specs do; the new tests assert the *same element* is now reachable by name (`getAllByRole(...)` `.toContain(getByDisplayValue(...))`) rather than replacing the existing lookup, so no existing assertion is weakened.
- **More than one control sharing a name.** "Name" appears on both a row input and an add-form input, so a bare `getByRole` is ambiguous — hence `getAllByRole(...).toContain(...)`.
- **A password input has no `textbox` role.** Located by `getByLabelText`, which is also the stronger assertion.
- **The guard flagging legitimately-named controls.** Its sensitivity spec pins acceptance of all five naming mechanisms, plus a closed cell not leaking into the next sibling and commented-out code not counting.
- **The enum guard catching attributes.** Anchored to a full-line JSX child expression; asserted clean against both apps before being added.

---

## Test Plan

1. Six focused component tests — one per affected file — locating each control by its accessible name, and re-asserting the blur-commit/submit behaviour where the spec already covered it.
2. Portal home: the localized status renders and the raw `RESOLVED` token does not.
3. Guard sensitivity: five naming mechanisms accepted, the defect flagged, non-cell controls ignored.
4. Every existing suite unchanged.

---

## Verification Steps

1. `pnpm --filter @crm/web test` — baseline **1212**.
2. `pnpm --filter @crm/portal test` — baseline **360**.
3. `pnpm --filter @crm/ui test` — **258**, expected unchanged (no shared code touched).
4. Guards: both `design-tokens.spec.ts`, plus `table-mobile-labels`, `fetch-state-messages`, `ticket-enum-messages`, `translation-status-messages`, `tailwind-content`.
5. `pnpm typecheck`, `pnpm lint`, `pnpm build`.
6. EN/AR parity exact (web 1003/1003, portal 181/181).
7. Re-run the unnamed-control scan: 1 remaining, the known doc-comment false positive.
8. Diff: `aria-label` additions plus one status line; nothing else.

---

## Done Criteria

- [ ] All 9 controls expose an accessible name; scan clean.
- [ ] Portal home renders the localized status.
- [ ] No new i18n key; EN/AR parity exact.
- [ ] No layout, spacing, typography, column, responsive or behaviour change.
- [ ] Both guards added, 0 offenders, with sensitivity coverage.
- [ ] web / portal / ui suites, typecheck, lint, build green; no test weakened.
- [ ] No backend, token, `packages/ui` or out-of-scope file touched.
