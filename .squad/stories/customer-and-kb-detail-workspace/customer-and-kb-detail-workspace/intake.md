> **Source:** manual entry (tracker skipped via `--no-tracker`).

# Story intake

- Folder: `.squad/stories/customer-and-kb-detail-workspace/customer-and-kb-detail-workspace/intake.md`

---

## Feature

- **Feature name (display):** Customer and KB detail workspace
- **Feature slug (folder under `plans/`):** `customer-and-kb-detail-workspace`

## Tracker (metadata only)

- **Work item id:** `159`
- **Labels:** ui, agent-workspace, customers, knowledge-base

---

## Title

```
Propagate the detail-page workspace pattern to Customer Detail and KB Article Detail
```

---

## Premise verification (measured at HEAD 2014e1d)

| Claim from recon | Customer detail | KB article detail |
|---|---|---|
| `sr-only` h1 | **still true** — `customer-detail-view.tsx:526` | **still true** — `article-detail-view.tsx:139` |
| identity is an always-editable `Input` | **still true** — `displayName`, blur-commit | **still true** — `title`, blur-commit |
| stacked full-width sections | **still true** — 5 sections, no column split | **partly** — page is tab-organised already |
| raw `Card p-surface` + `h2` sections | **already migrated** — 5 `SectionCard`s (Story 154) | 0 cards; version history is a raw `<section>` + `h2` |

**Scope adapted from the original recon**, which predates Story 154:

- Customer detail's `SectionCard` adoption is **already done**. Do not redo it.
- KB article detail is **not** a stacked-card page. Its content lives inside Story 137's locale `Tabs`, and the body editor wants full width. A two-column split would fight the editor, so it gets the identity fix and one `SectionCard`, **not** a column layout.

---

## Description

```
Ticket detail (Story 156) established the detail-page pattern: a visible h1,
an explicit view/edit distinction for the editable identity, and a two-column
workspace that separates what an agent writes from what they read.

Customer detail and KB article detail still carry the pre-156 shape — an
`sr-only` h1 with the identity rendered as a permanently-open text input. Both
pages read as forms rather than records, and on both, the page's most
important text is the one thing not rendered as text.

Apply the pattern, adapted to what each page actually is.
```

---

## Acceptance criteria

```
Both pages
- Exactly one meaningful, VISIBLE h1 carrying the record's identity.
- The identity is editable behind an explicit affordance, not permanently open.
- Existing PATCH, blur-commit and revert-on-error behaviour preserved exactly.
- Escape abandons an edit (matching Story 156).
- Heading hierarchy intact; no semantic heading replaced by a div.
- No physical-direction utility; RTL guards green.

Customer detail
- Two-column workspace at `lg`; one column below it, main column first.
- Main: tickets, notes. Side: contacts, attachments, anonymize.
- All five existing sections preserved; nothing removed or hidden.
- The New Ticket action and status Select stay reachable at every width.

KB article detail
- Locale Tabs, publishing, category, body, translations untouched.
- Version history adopts SectionCard (currently a raw <section> + h2).
- Status badge and publish action grouped with the identity, wrapping on narrow screens.
- NO column layout — the editor needs full width.

Regression
- web + ui suites, typecheck, lint, build green.
- No backend, API, RBAC, domain, routing or i18n-behaviour change.
- Portal untouched.
```

---

## Out of scope

- Navigation, ticket list, ticket detail, portal.
- Backend / API / RBAC / domain-model changes.
- Ticket-badge sharing; new design system; dark mode.
- The other 41 SectionCard candidates and 6 QueryStateCard candidates.
- Any change to the KB domain: article API, translations API, publishing, permissions, locale behaviour, content storage.
