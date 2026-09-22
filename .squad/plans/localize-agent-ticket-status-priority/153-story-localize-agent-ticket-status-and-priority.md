# Story 153 — Localize agent ticket status and priority

---

## Prerequisites

- **Story 148 completed** — the portal's equivalent implementation. [../portal-ticket-search-and-filtering/00-overview.md](../../plans/00-index.md) is indexed; the live reference files are `apps/portal/messages/en.json` (`tickets.status`), `apps/portal/src/components/tickets/ticket-list-view.tsx`, and `apps/portal/src/test/ticket-filter-messages.spec.ts`.
- No backend, API or schema dependency.

---

## Story Goal

Every `TicketStatus` and `TicketPriority` value shown in the agent workspace renders a translated label. An Arabic-speaking agent stops reading `IN_PROGRESS` / `URGENT` in Latin capitals.

**Not in scope:** the portal (Story 148 did it), sharing badge logic across apps (F12), any backend enum/DTO change, any Badge colour change.

---

## Context — Read These Files First

1. `apps/portal/messages/en.json` / `ar.json` — the `tickets.status` block added by Story 148. Four keys, `OPEN`/`IN_PROGRESS`/`RESOLVED`/`CLOSED`. This is the shape to mirror.
2. `apps/portal/src/test/ticket-filter-messages.spec.ts` — the guard to mirror: asserts each key exists, is non-empty, is not the raw enum value, that labels are distinct, and that Arabic values carry Arabic script (`/[؀-ۿ]/`).
3. `apps/web/src/lib/ticket-badges.ts` — `ticketStatusBadgeVariant` and `ticketPriorityBadgeVariant`. **These map from the RAW enum and must keep doing so.** Only the visible text changes.
4. `apps/web/messages/en.json` — the `common` block (`appName`, `loading`, `updating`, `pagination`, `errors`, …). This is where the new keys go; see Design decision 1.
5. The eight consumer files and their namespaces:

| File | Lines | Existing namespaces |
|---|---|---|
| `apps/web/src/components/tickets/ticket-list-view.tsx` | 393, 397 | `common`, `tickets` |
| `apps/web/src/components/tickets/ticket-detail-view.tsx` | 319, 346 | `tickets` |
| `apps/web/src/components/tickets/customer-context-panel.tsx` | 99, 101 | `tickets` |
| `apps/web/src/components/customers/customer-detail-view.tsx` | 621, 623 | `common`, `customers` |
| `apps/web/src/components/dashboard/dashboard-view.tsx` | 151, 152, 362, 364 | `dashboard`, `tickets` |
| `apps/web/src/components/dashboard/tasks-panel.tsx` | 141 | `dashboard` |
| `apps/web/src/components/sla-policies/sla-policy-list-view.tsx` | 179 | `slaPolicies` |
| `apps/web/src/components/reporting/reports-view.tsx` | 271, 274 | `reporting` |

---

## Design decisions

### 1 — One key set under `common`, not five copies

The eight files span six namespaces (`tickets`, `dashboard`, `customers`, `slaPolicies`, `reporting`, `common`). Putting `status`/`priority` labels inside `tickets` would force `dashboard`, `customers`, `slaPolicies` and `reporting` to each carry their own duplicate copy — five sets of the same eight strings, drifting independently.

`common` already holds exactly this class of cross-cutting UI string (`loading`, `updating`, `pagination`, `errors`). Add:

```
common.ticketStatus.{OPEN,IN_PROGRESS,RESOLVED,CLOSED}
common.ticketPriority.{LOW,MEDIUM,HIGH,URGENT}
```

Three of the eight files already call `useTranslations("common")`; the rest add one call.

**This deliberately differs from the portal**, which scoped its keys to `tickets.status.*`. The portal has exactly one consumer file, so namespacing cost it nothing; the agent app has eight across six namespaces. Same labels, same guard shape, different placement — for a measured reason.

### 2 — `TaskPriority` reuses `ticketPriority`

`TaskPriority` (`schema.prisma:1818`) and `TicketPriority` (`:547`) have **identical members** — `LOW`/`MEDIUM`/`HIGH`/`URGENT` — and identical user-facing meaning ("how urgent"). `tasks-panel.tsx:141` uses `common.ticketPriority.*`. Adding a parallel `common.taskPriority.*` with the same four strings would be duplication with no reader-visible difference.

### 3 — Badge variants keep reading the raw enum

`ticketStatusBadgeVariant(ticket.status)` stays exactly as it is. Only the Badge's **children** change from `{ticket.status}` to the label. Colour mapping and the enum contract are untouched.

### 4 — Select options: label visible, value raw

`ticket-detail-view.tsx:319/346` are Radix `Select`s driving mutations. The `SelectItem` `value` **must stay the raw enum** (it is sent to the API); only the item's visible text is localized. Getting this backwards would break ticket updates.

---

## Frontend Tasks

No backend changes required.

### 1 — Add the keys

**File: `apps/web/messages/en.json`** — inside `common`:

```json
"ticketStatus": { "OPEN": "Open", "IN_PROGRESS": "In progress", "RESOLVED": "Resolved", "CLOSED": "Closed" },
"ticketPriority": { "LOW": "Low", "MEDIUM": "Medium", "HIGH": "High", "URGENT": "Urgent" }
```

**File: `apps/web/messages/ar.json`** — the same keys with real Arabic. Reuse the portal's existing status wording verbatim for consistency across the two apps.

### 2 — Replace the render sites

For each row in the Context table, replace the raw value with the localized label, adding `useTranslations("common")` where the file lacks it. Pattern:

```tsx
const tCommon = useTranslations("common");
// …
<Badge variant={ticketStatusBadgeVariant(ticket.status)}>
  {tCommon(`ticketStatus.${ticket.status}` as Parameters<typeof tCommon>[0])}
</Badge>
```

The `as Parameters<typeof t>[0]` cast is this repository's existing convention for template i18n keys — see `apps/portal/src/components/tickets/ticket-list-view.tsx`.

`reports-view.tsx` (271, 274) uses the value twice: once building an `ariaLabel` string and once as a chart `label`. Localize **both**, so the chart and its screen-reader description agree.

### 3 — The guard

**Create file: `apps/web/src/test/ticket-enum-messages.spec.ts`**, mirroring `apps/portal/src/test/ticket-filter-messages.spec.ts`: every member of both enums has a key in both catalogs; values are non-empty; no value equals its raw enum name; labels are distinct within each set; Arabic values match `/[؀-ۿ]/`.

---

## Edge Cases & Failure Modes

- **A new enum member is added later.** The guard iterates a hard-coded member list; extending the Prisma enum without adding keys leaves the UI printing the raw value. The guard's member list is the tripwire — keep it exhaustive.
- **`Select` value localized by mistake** (`ticket-detail-view.tsx:319/346`). The mutation would send a translated string to the API and fail validation. Covered by Test Plan item 4.
- **Badge variant fed a label instead of the enum.** `ticketStatusBadgeVariant("Open")` falls through to its default branch, silently changing colours. Covered by Test Plan item 3.
- **EN/AR parity drift.** The repo has exact parity today (992/992). Adding a key to one catalog only breaks it. The guard asserts both.
- **`reports-view.tsx` chart label width.** Localized labels are longer than the enum ("In progress" vs `IN_PROGRESS` is shorter; Arabic differs again). `BarChart`'s row label already carries `min-w-0 break-words` from Story 146, so it wraps rather than overflowing.

---

## Test Plan

1. **New** `apps/web/src/test/ticket-enum-messages.spec.ts` — the catalog guard (above).
2. **Update** `apps/web/src/components/tickets/ticket-list-view.spec.tsx` — assertions that currently expect `"OPEN"` / `"URGENT"` text must expect the key path (these specs stub `useTranslations` to echo keys) or the label, matching that file's existing convention. **Do not weaken an assertion to `toBeInTheDocument()` to dodge the change.**
3. **Add** to the ticket-list spec: the Badge still receives the variant derived from the raw enum (assert the variant class, as `ticket-badges` specs already do).
4. **Add** to `ticket-detail-view.spec.tsx`: changing status through the `Select` still calls the mutation with the **raw enum** value.
5. Existing specs for dashboard, customer detail, tasks panel, SLA policies and reports must pass, updated only where they assert the raw text.

---

## Verification Steps

1. **Focused:** from `apps/web`, `npx vitest run src/test/ticket-enum-messages.spec.ts src/components/tickets`.
2. **App:** from the repo root, `pnpm --filter @crm/web test`. Baseline **1178 passed**.
3. **Regression:** `pnpm --filter @crm/portal test` (**354**) must be untouched — this story changes no portal file.
4. **Typecheck / lint:** `pnpm typecheck`, `pnpm lint` (0 problems).
5. **Diff:** `git status --short` shows only `apps/web/messages/*.json`, the eight component files, their specs, and the new guard.

---

## Done Criteria

- [ ] `common.ticketStatus.*` and `common.ticketPriority.*` exist in both web catalogs with real Arabic.
- [ ] All 15 raw render sites show localized labels.
- [ ] `ticketStatusBadgeVariant` / `ticketPriorityBadgeVariant` still receive the raw enum; no colour changes.
- [ ] `Select` option **values** remain raw enums; a status change still sends the enum to the API.
- [ ] EN/AR parity exact; guard spec passes.
- [ ] `apps/web` suite, typecheck, lint green; no portal file modified.
