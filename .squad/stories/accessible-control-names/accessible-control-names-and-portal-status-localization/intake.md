> **Source:** manual entry (tracker skipped via `--no-tracker`).

# Story intake

- Folder: `.squad/stories/accessible-control-names/accessible-control-names-and-portal-status-localization/intake.md`

---

## Feature

- **Feature name (display):** Accessible control names
- **Feature slug (folder under `plans/`):** `accessible-control-names`

## Tracker (metadata only)

- **Work item id:** `164`
- **Labels:** ui, accessibility, i18n

---

## Title

```
Accessible control names and final portal ticket-status localization
```

---

## Premise verification (measured at HEAD 8e8a58c)

A source scan of all 133 `Input`/`Textarea`/`SelectTrigger` renders in both
apps found **10** with no accessible name. One — `reports-view.tsx:98` — is a
false positive inside a doc comment, leaving **9 real**:

| Site | Context | Named by today |
|---|---|---|
| `branches/branch-departments-view:259` | inside `TableCell` | nothing |
| `kb-categories/kb-categories-view:141` | inside `TableCell` | nothing |
| `ticket-categories/ticket-categories-view:144` | inside `TableCell` | nothing |
| `users/user-list-view:320` (email) | inside `TableCell` | nothing |
| `users/user-list-view:388` (full name) | inside `TableCell` | nothing |
| `roles/role-list-view:117` | inside `TableCell` | nothing |
| `customers/customer-detail-view:160` | portal password | adjacent visual `<span>` + placeholder |
| `users/user-list-view:338` | password reset | adjacent visual `<span>` + placeholder |
| `tickets/ticket-detail-view:903` | add-note `Textarea` | placeholder only |

**Why the table cases hid for so long:** `TableCell`'s `label` prop (Story 150)
renders a **visible** span that is `sm:hidden`. Below `sm` it stands in for the
hidden `<th>`; at `sm` and up it is `display:none` and therefore absent from
the accessibility tree. It was never an accessible name — and a `<th>` does not
name a form control nested inside its column either. The prop sitting right
there made these look handled.

Separately, `portal/portal-home-view.tsx:148` renders `{ticket.status}` — a
customer reads `IN_PROGRESS`, and in Arabic a bare English SCREAMING_SNAKE
token inside an RTL page. Its two siblings, the portal ticket list (`:236`) and
ticket detail (`:129`), already render it through `t("status.<VALUE>")`, and
the keys exist in both locales.

---

## Description

```
Nine interactive controls have no accessible name, and one screen still shows
a customer a raw enum. Both are concrete, mechanical, and every string needed
already exists.

Six of the nine are inline-edit inputs inside table cells, where the existing
mobile-label convention actively misleads: it looks like a label and is not
one at desktop widths.
```

---

## Acceptance criteria

```
Accessible names
- All 9 controls expose an accessible name.
- Each reuses the translation key already present at that site; NO new key.
- aria-label only -- no visible label, no FormField migration, no layout,
  spacing, typography, column or responsive change.
- Edit / blur-commit / submit behaviour unchanged.

Portal status
- portal-home renders the localized status, never the raw enum.
- No new translation, no enum rename, no API/badge/backend change.

Guards
- A guard for controls inside a TableCell without an accessible name, which
  accepts every legitimate naming mechanism (label, Label, FormField,
  aria-labelledby, id) and produces zero false positives.
- A narrow guard against a ticket enum rendered as a JSX child.
- No existing accessibility guard weakened.

Regression
- web / portal / ui suites, typecheck, lint, build green.
- EN/AR parity exact.
```

---

## Out of scope

- The 9 early-return query loading states (Story 165 territory).
- The 2 `ArticleDetailSkeleton` instances missing `aria-hidden`.
- The 6 raw status-palette sites (several have no exact semantic token).
- `FormField` adoption, navigation, design tokens, backend, RBAC, new i18n keys.
