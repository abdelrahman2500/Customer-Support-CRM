# Story 136 — Portal Home: replace the placeholder landing page with a real one

---

## Prerequisites

- **Story 135 completed** (`f9276c6 feat(story-135): adopt shared UI primitives in the portal`) — see [../portal-adopts-shared-ui-primitives/135-story-portal-adopts-shared-ui-primitives.md](../portal-adopts-shared-ui-primitives/135-story-portal-adopts-shared-ui-primitives.md). That story made `<Alert variant="destructive">` the portal's error surface and added the `RAW_ERROR_BOX` guard to `apps/portal/src/design-tokens.spec.ts`. **Any error UI this story adds must use `Alert`, or that guard fails the build.**
- **Story 53 / PORTAL-1** — `useMyTicketsQuery` and `myTicketsQueryKey` already exist in `apps/portal/src/hooks/use-portal-tickets.ts` and resolve a `PaginatedResponse<PortalTicketSummary>`.
- **Story 54 / Story 109 / S-8c** — `usePublishedArticlesQuery(search?, locale?, page?)` already exists in `apps/portal/src/hooks/use-portal-knowledge-base.ts`.
- **Story S-5** — `ticketStatusBadgeVariant` exists in `apps/portal/src/lib/ticket-badges.ts`. **Consumed, never modified** — its cross-app duplication is deliberate and documented in that file's own doc comment.
- **No backend prerequisite.** This story adds no endpoint, controller, service, DTO, permission or migration.

---

## Story Goal

`apps/portal/src/app/[locale]/(customer)/home/page.tsx` is 28 lines whose entire body is one sentence and one link. Its i18n key is literally named `placeholder` and reads *"This page confirms you're securely signed in."* It is the **canonical landing page** for every authenticated portal customer — `apps/portal/src/app/[locale]/page.tsx` redirects here, `PortalHeader`'s `signedInAs` link points here, and `(customer)/layout.tsx`'s SSR auth guard lands here after login.

Replace it with the smallest coherent, genuinely useful home built **only** on existing backend capabilities:

1. A short localized welcome/context heading and one supporting line.
2. A **ticket panel**: the accurate total, plus the **5** most recent tickets, each linking to its existing detail route.
3. A **knowledge-base panel**: **5** published articles, each linking to its existing detail route.
4. Clear navigation to the portal's four existing destinations.

Both panels are a **bounded preview, never a replacement for the full listings** — each links on to its existing full screen, which keeps its own pagination.

**Not in scope:** any backend change, any `apps/web` change, any `packages/ui` change, `PortalHeader`, the language switcher, authentication, password work, `QueryStateCard`/`EmptyState`/`Card` adoption, dark mode, reporting, realtime, new routes, new dependencies, and any change to `apps/portal/src/lib/ticket-badges.ts`.

---

## Context — Read These Files First

1. `apps/portal/src/app/[locale]/(customer)/home/page.tsx` — the whole file (28 lines). Note it is currently an `async` **server** component using `getTranslations` from `next-intl/server`, rendering `t("placeholder")` and one `Link`. This is the file being replaced.
2. `apps/portal/src/app/[locale]/(customer)/tickets/page.tsx` — 4 lines. The convention every other portal route follows: a thin server page delegating to a client view. `knowledge-base/page.tsx`, `notifications/page.tsx` and `chat/page.tsx` are identical in shape. **Home is the lone exception; this story removes that exception.**
3. `apps/portal/src/components/tickets/ticket-list-view.tsx` — read **lines 1–19** (the `"use client"` directive and the exact `@crm/ui` import set) and **lines 80–100** (the `<ol>`/`<li>` row: `Link` + `Badge variant={ticketStatusBadgeVariant(ticket.status)}` + `toLocaleDateString(locale)`). This is the row shape to mirror.
4. `apps/portal/src/components/knowledge-base/article-list-view.tsx` — read **lines 105–137**. The article row carries the **documented 390px overflow fix**: `min-w-0 break-words` on the title `Link`, `shrink-0` on the trailing span, and `gap-2` on the row, with the comment recording *"measured: 9px of horizontal page overflow at 390px"*. Read that comment in full — this story must apply the same treatment.
5. `apps/portal/src/components/portal/portal-header.tsx` — read **lines 85–86** (`useUnreadNotificationCountQuery()` / `unreadCount`) and **lines 152–155** (the unread badge on the notifications nav link). This proves the unread count is already on every page. **Do not modify this file.**
6. `apps/portal/src/hooks/use-portal-tickets.ts` — read **lines 31–44**. `myTicketsQueryKey(page)` and `useMyTicketsQuery(page?)`, which spreads `preservePreviousResults`.
7. `apps/portal/src/hooks/use-portal-knowledge-base.ts` — the whole file (36 lines). `usePublishedArticlesQuery(search?, locale?, page?)`; note the key already includes `locale`.
8. `apps/portal/src/lib/tickets-api.ts` — read **lines 9–25** for `PortalTicketStatus` and `PortalTicketSummary`, and **lines 88–94** for `listMyTickets` returning `PaginatedResponse<PortalTicketSummary>`.
9. `apps/portal/src/lib/knowledge-base-api.ts` — read **lines 12–26** for `PortalArticleSummary` and the `KbLocale = "EN" | "AR"` type.
10. `apps/portal/src/lib/paginated.ts` — the whole file. `PaginatedResponse<T>` is `{items,total,page,pageSize,totalPages}`; the doc comment states `total` *"counts every row matching the request's filters and authorization scope regardless of page"*. **That is what makes the total figure honest.**
11. `apps/portal/src/components/tickets/ticket-list-view.spec.tsx` — read **lines 1–47**. The exact spec conventions: `vi.mock("next/navigation")`, `vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))`, `vi.mock` of the hook module, and the `queryResult(...)` / `ticketPage(...)` helpers.
12. `apps/portal/src/app/[locale]/(customer)/home/loading.spec.tsx` — the whole file (18 lines). It asserts the shared `RouteLoadingSkeleton` renders. **It must keep passing unmodified.**
13. `apps/portal/src/design-tokens.spec.ts` — read the Story 135 `RAW_ERROR_BOX` test at the end of the file, so the error UI added here is written to pass it.
14. Grep `rounded-md border border-rule bg-surface p-4` in `apps/portal/src` to see the established surface convention (13 occurrences).

---

## Product rules (from story)

| | Current behaviour | New behaviour |
|---|---|---|
| Home page body | One sentence (`home.placeholder`) + one link | Welcome heading + supporting line, ticket panel, KB panel, navigation |
| Component kind | `async` server component | Thin server page + client view |
| Ticket data | none | `total` + **5** most recent, from the existing first page |
| KB data | none | **5** published articles, from the existing first page |
| Unread count | shown by `PortalHeader` on every page | **unchanged** — not repeated on home |
| Ticket status counts | none | **still none** — cannot be computed honestly (see Design decisions) |

---

## Design decisions

### 1. Thin server page + client view

The data hooks are client-side React Query; the page is currently a server component. Convert `home/page.tsx` into the same 4-line shape every sibling route uses, delegating to a new client view.

**Create file: `apps/portal/src/components/portal/portal-home-view.tsx`** — `"use client"`, using `useTranslations` (not the server `getTranslations`) and `useParams` for `locale`, exactly as `ticket-list-view.tsx` does.

`home/loading.tsx` is untouched and keeps rendering `RouteLoadingSkeleton`.

### 2. Status breakdown — REJECTED, cannot be computed honestly

A "3 open, 2 resolved" tile was the obvious candidate for a ticket summary. It is **excluded, not deferred**, because discovery proved it cannot be built correctly on existing capabilities:

1. `ListPortalTicketsQueryDto` accepts **only** `page` and `pageSize`. `apps/api/src/modules/portal/portal-tickets.controller.ts`'s own doc comment says it outright: *"no other filters exist for this list"*. **There is no status filter.**
2. `DEFAULT_PAGE_SIZE` is **25** (`apps/api/src/common/pagination/pagination-query.dto.ts`). Counting statuses client-side from the first page would be **silently wrong** for any customer with more than 25 tickets — under-reporting with no indication to the reader.
3. Fetching every page to count client-side turns one landing-page render into N requests and still races.

Correcting this needs a status filter or a counts endpoint — **a new backend capability, which this story forbids**. So the panel shows the **accurate `total`** (correct by construction) and the **5 most recent** tickets (correct by construction — `TicketsService.listTicketsForCustomer` already orders `[{createdAt:"desc"},{id:"desc"}]`). Neither figure can mislead.

**Do not approximate this.** If a breakdown is wanted later it is a separate story that first decides filter-vs-endpoint.

### 3. Unread-notification tile — REJECTED as duplication

`useUnreadNotificationCountQuery()` exists and works, but `PortalHeader` **already renders the unread count as a badge on the notifications nav link on every authenticated page** (`portal-header.tsx` lines 85–86 and 152–155). A second count on the home page would repeat the same number a few centimetres below the header that already shows it, and add a second subscriber to the same query for no new information.

**The header badge remains the single place unread count is surfaced.** `PortalHeader` is not modified.

### 4. Counts are fixed at 5 and 5, sliced from the already-fetched page

Both queries already fetch up to 25 rows on page 1. Take `.items.slice(0, 5)` from each. **No extra request, no new query parameter, no new endpoint.** A customer with fewer than 5 of either simply sees fewer rows. Each panel links on to its full listing, which keeps its own `Pagination`.

Define the count as a named module constant rather than a bare `5` in two places.

### 5. Surface styling: the inline convention, not `Card`

`@crm/ui` exports `Card`/`CardHeader`/…, but **zero files in either app use them**. The established convention in both apps is the inline `rounded-md border border-rule bg-surface p-4` (13 occurrences in `apps/portal` alone — `chat-widget.tsx`, `ticket-detail-view.tsx`, `ticket-list-view.tsx`, and the current `home/page.tsx` itself). **Match that.** Adopting `Card` here would be a design-system story, which this is not.

### 6. Welcome copy must not repeat the header

`PortalHeader` already renders `home.signedInAs` ("Signed in as {name}") on every authenticated page. The home heading must **not** restate the contact's name. It must also **not invent profile or business data** — no company name, no account tier, no "last login", no ticket-health verdict, and no new backend field. It orients the reader toward what the page offers and what they can do next, using only what the page already renders.

---

## Implementation tasks

### 1 — Replace the page with a thin server page

**File: `apps/portal/src/app/[locale]/(customer)/home/page.tsx`**

Replace the whole file with the sibling convention:

```tsx
import { PortalHomeView } from "@/components/portal/portal-home-view";

export default function PortalHomePage() {
  return <PortalHomeView />;
}
```

Keep a short doc comment recording that Story 136 replaced the Story 52/53 placeholder and why this is now a client view (the data hooks are client-side React Query). Remove the now-unused `next-intl/server` and `next/link` imports.

### 2 — Create the client view

**Create file: `apps/portal/src/components/portal/portal-home-view.tsx`**

Shape it on `ticket-list-view.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMyTicketsQuery } from "@/hooks/use-portal-tickets";
import { usePublishedArticlesQuery } from "@/hooks/use-portal-knowledge-base";
import { ticketStatusBadgeVariant } from "@/lib/ticket-badges";
import type { KbLocale } from "@/lib/knowledge-base-api";
import { Alert, Badge, Skeleton } from "@crm/ui";

/** Story 136 — a bounded preview, never a replacement for the full
 * listings: each panel links on to its own screen, which keeps its own
 * pagination. */
const HOME_PREVIEW_COUNT = 5;
```

Resolve the KB locale exactly as `article-list-view.tsx` does — `locale.toUpperCase() as KbLocale` — so the home request hits the same query key as the KB screen and reuses its cache rather than issuing a second, differently-keyed fetch.

Overall structure: a welcome block, then the two panels, then the navigation block — each panel its own `rounded-md border border-rule bg-surface p-4` surface, stacked in a `flex flex-col gap-4` (or a grid that collapses to one column below `sm`; see Edge Cases for the 390px rule).

### 3 — Welcome block

A heading plus one supporting line, from new keys under the existing `home` namespace. The page is the route's main content, so the heading is the page's `<h1>`; each panel heading below it is an `<h2>`, preserving heading order under `(customer)/layout.tsx`'s `<main id="main-content">`.

### 4 — Ticket panel

Drive from `useMyTicketsQuery()` (no argument — page 1, the same key the tickets screen uses for its first page).

Branches, in this order, mirroring the sibling views:

- **loading** — `<Skeleton />`, as `ticket-list-view.tsx` does.
- **error** — `<Alert variant="destructive">` with the existing `tickets.list.error` copy and a retry `<Button variant="outline" size="sm" onClick={() => ticketsQuery.refetch()}>` using the existing `tickets.list.retry`. This is the Story 135 shape; reusing the existing keys means **no new error copy**.
- **empty** (`total === 0`) — a quiet inline sentence in the portal's established empty voice (`text-sm text-ink-subtle`), plus the link into `/{locale}/tickets` where the create form lives.
- **populated** — the accurate `total` from the envelope, then `items.slice(0, HOME_PREVIEW_COUNT)` as an `<ol>` of rows mirroring `ticket-list-view.tsx` lines 81–99: a `Link` to `/${locale}/tickets/${ticket.id}`, `<Badge variant={ticketStatusBadgeVariant(ticket.status)}>{ticket.status}</Badge>`, and `new Date(ticket.createdAt).toLocaleDateString(locale)`.

**Apply the article row's overflow treatment to the ticket rows** — see Edge Cases; the ticket subject is free text and the existing ticket row does **not** carry that fix.

End the panel with a link to `/{locale}/tickets` (the full listing).

### 5 — Knowledge-base panel

Drive from `usePublishedArticlesQuery(undefined, kbLocale)`. Same four branches, reusing the existing `knowledgeBase.list.error` / `knowledgeBase.list.retry` / `knowledgeBase.list.empty` keys. Populated: `items.slice(0, HOME_PREVIEW_COUNT)` as rows mirroring `article-list-view.tsx` lines 111–136 — `Link` to `/${locale}/knowledge-base/${article.id}` carrying `min-w-0 break-words`, trailing `categoryName ?? t("list.noCategory")` carrying `shrink-0`, row carrying `gap-2`. End with a link to `/{locale}/knowledge-base`.

**The two panels are independent.** Render each branch off its own query; one failing must not take the other down.

### 6 — Navigation block

Links to the four existing destinations, reusing the **existing** nav labels rather than inventing new copy: `tickets.nav` ("My Tickets"), `knowledgeBase.nav` ("Knowledge Base"), `chat.nav` ("AI Chat"), `notifications.nav` ("Notifications"). **No new route, and no change to the existing navigation structure** — these point at routes that already exist and `PortalHeader` keeps its own nav untouched.

### 7 — i18n

**Files: `apps/portal/messages/en.json` and `apps/portal/messages/ar.json`**

- **Delete `home.placeholder` from both files.** No source file may reference it afterwards.
- Keep `home.myTicketsLink` only if the new markup still uses it; delete it from both files if it does not.
- Add the new keys under the existing `home` namespace in **both** files, with real Arabic translation (never English pasted into `ar.json`). The existing `home` block already holds `signedInAs`, `signOut`, `realtimeReconnecting`, `myTicketsLink`, `logoAlt`, `languageSwitcher`, `nav` — add alongside them, and **do not touch** the `signedInAs`/`nav`/`languageSwitcher` entries, which `PortalHeader` owns.
- Prefer reusing `tickets.list.*` and `knowledgeBase.list.*` for panel error/retry/empty copy over declaring near-duplicates.

---

## Edge Cases & Failure Modes

- **390px horizontal overflow — the load-bearing responsive rule.** A ticket subject and an article title are both free text a user typed. A flex item's default `min-width: auto` refuses to shrink below an unbreakable word, which is exactly the bug `article-list-view.tsx` lines 112–124 documents (*"measured: 9px of horizontal page overflow at 390px"*). Every row this story adds must carry `min-w-0 break-words` on the title/subject link, `shrink-0` on the trailing badge/date/category, and `gap-2` on the row. **Note the existing ticket row in `ticket-list-view.tsx` does NOT carry this fix** — do not copy it verbatim; copy the article row's corrected shape.
- **Zero physical-direction utilities.** `apps/portal/src` currently contains **zero** `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-`/`text-left`/`text-right` occurrences. This story must keep that at zero — use logical/neutral utilities only (`gap-*`, `px-*`, `py-*`, `mt-*`, `justify-between`, `text-start`).
- **Independent panel failure.** Each panel owns its own query and its own four branches. A 500 on `/portal/knowledge-base` must still leave the ticket panel rendered, and vice versa. Do not gate the page on a combined `isLoading`.
- **`total` vs the 5 shown.** `total` counts every ticket regardless of page; the list shows at most 5. The copy must not imply the list is exhaustive — the "view all" link is what reconciles them. Never render `items.length` as if it were the total.
- **Fewer than 5 rows.** `slice(0, 5)` on a 2-item array yields 2. No padding, no placeholder rows.
- **Empty vs error.** `total === 0` with a successful query is the **empty** branch, not an error. An errored query must never render as "you have no tickets" — that is the exact confusion `QueryStateCard`'s own doc comment warns about, and the branch order above prevents it.
- **Error copy must not be new.** Reuse `tickets.list.error`/`retry` and `knowledgeBase.list.error`/`retry`. Introducing new error strings widens the i18n surface for no gain.
- **`RAW_ERROR_BOX` guard.** Story 135's guard fails on `border-red-200 bg-red-50`. Hand-rolling an error box instead of using `Alert` will fail `pnpm --filter @crm/portal test`.
- **KB locale key alignment.** Passing a lower-case locale, or omitting it, produces a **different** query key from the KB screen's (`publishedArticlesQueryKey` includes `locale`), causing a redundant second fetch. Use `locale.toUpperCase() as KbLocale`.
- **Heading order.** `(customer)/layout.tsx` renders `<main id="main-content">` and a skip-link targets it. The welcome heading is the page's single `<h1>`; panel headings are `<h2>`. Do not leave the page with no `<h1>` or with two.
- **Server/client boundary.** `useTranslations` (client) replaces `getTranslations` (server). Importing `next-intl/server` into the new `"use client"` file will fail the build.
- **`home/loading.spec.tsx`.** It renders `loading.tsx`, not the page, so it is unaffected — but it must be confirmed still green, not edited.

---

## Test Plan

1. **Create `apps/portal/src/components/portal/portal-home-view.spec.tsx`**, following `ticket-list-view.spec.tsx` lines 1–47 exactly: `vi.mock("next/navigation")` returning `{ locale: "en" }`, `vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))`, `vi.mock` of **both** hook modules, and local `queryResult(...)` / page-envelope helpers. Assert on translation **keys**, not English copy — that is what the mocked `useTranslations` returns.
2. **Ticket panel — loading**: `isPending: true` renders a skeleton (`container.querySelector(".animate-pulse")`), matching the sibling specs' assertion style.
3. **Ticket panel — error**: `isError: true` renders the `tickets.list.error` key and a retry control; clicking it calls `refetch`.
4. **Ticket panel — empty**: success with `total: 0`, `items: []` renders the empty copy and **not** the error copy.
5. **Ticket panel — populated, capped at 5**: supply **7** tickets and assert exactly **5** rows render, that the 6th and 7th subjects are absent, and that the rendered `total` reflects the envelope's `total` (set it to something larger than 7 to prove `total` is not `items.length`).
6. **Ticket row content**: a row links to `/en/tickets/{id}` and renders the status badge for that status.
7. **KB panel — the same four branches**, and **populated capped at 5** with 7 articles supplied.
8. **Panel independence**: ticket query errored + KB query successful renders the KB rows **and** the ticket error simultaneously.
9. **No placeholder**: assert the view does not render the `home.placeholder` key.
10. **Unchanged, must stay green without edits**: `apps/portal/src/app/[locale]/(customer)/home/loading.spec.tsx`, `portal-header.spec.tsx` (proves the header and its unread badge are untouched), `ticket-list-view.spec.tsx`, `article-list-view.spec.tsx`, and `design-tokens.spec.ts` (both the S-1 guard and Story 135's `RAW_ERROR_BOX`).
11. **No spec may be weakened** to accommodate this story. A break means the implementation is wrong (`CLAUDE.md` §4).

---

## Verification Steps

1. **Baseline first:** `pnpm --filter @crm/portal test` — record the real current counts (41 files / 301 tests at `f9276c6`; re-measure rather than assuming).
2. **Portal tests:** `pnpm --filter @crm/portal test`
3. **Web regression (must be untouched):** `pnpm --filter @crm/web test`
4. **Typecheck:** `pnpm typecheck`
5. **Lint:** `pnpm lint`
6. **Build:** `pnpm build`
7. **Placeholder gone:**
   ```
   grep -rn 'placeholder' apps/portal/messages/en.json apps/portal/messages/ar.json
   grep -rn 'home.placeholder\|"placeholder"' apps/portal/src
   ```
   Neither may report a `home.placeholder` key or reference.
8. **i18n parity:** re-run the key-path comparison of `apps/portal/messages/{en,ar}.json` — **0** missing in either direction, and no new `ar` value byte-identical to its `en` counterpart except legitimately-shared tokens.
9. **Zero physical-direction utilities:**
   ```
   grep -rnE '\b(ml|mr|pl|pr|text-left|text-right)-[0-9a-z]+' apps/portal/src --include=*.tsx
   ```
   must report **0**, as it does today.
10. **Responsive:** confirm no horizontal page overflow at 390px width — the condition `article-list-view.tsx`'s own comment records measuring.
11. **Scope containment:** `git status --short` and `git diff --stat` must list only `home/page.tsx`, the new `portal-home-view.tsx`, its new spec, and the two message catalogs. **Any** `apps/web/**`, `packages/**`, `portal-header.tsx`, or `ticket-badges.ts` entry is a scope violation.
12. **E2E:** the portal home is not covered by any spec in `apps/e2e/tests/`, and Docker/Postgres is currently unavailable, so no E2E run is expected or claimed. If Docker is available at implementation time, run `session-expiry-and-refresh.spec.ts` (it traverses login → authenticated portal) as a sanity check; otherwise record the environmental blocker per `CLAUDE.md` §5 rather than asserting a pass.

---

## Done Criteria

- [ ] `home/page.tsx` is a thin server page delegating to `PortalHomeView`; no placeholder copy remains.
- [ ] `home.placeholder` is deleted from **both** `en.json` and `ar.json`, and no portal source references it.
- [ ] The ticket panel renders the envelope's accurate `total` plus exactly the **5** most recent tickets, each linking to `/{locale}/tickets/{id}` with a status badge from the unmodified `ticketStatusBadgeVariant`.
- [ ] The knowledge-base panel renders exactly **5** published articles, each linking to `/{locale}/knowledge-base/{id}`.
- [ ] Both panels link on to their full listings; neither replaces them.
- [ ] Navigation to the four existing destinations is present, reusing the existing `*.nav` labels; **no new route** and **no change to existing portal navigation structure**.
- [ ] Each panel independently handles loading, empty, error and populated; one panel's error does not suppress the other.
- [ ] Every error state renders through `<Alert variant="destructive">`; `design-tokens.spec.ts`'s `RAW_ERROR_BOX` guard passes.
- [ ] The welcome heading and supporting copy do **not** repeat `PortalHeader`'s `signedInAs`, and invent no profile/business data.
- [ ] All new copy exists in **both** catalogs with real Arabic; portal i18n parity stays at 0 missing keys either direction.
- [ ] `apps/portal/src` still contains **zero** raw physical-direction utilities.
- [ ] No horizontal page overflow at 390px; free-text subjects/titles carry `min-w-0 break-words` with `shrink-0` trailing elements.
- [ ] The page has exactly one `<h1>`; panel headings are `<h2>`; the `#main-content` skip-link target still works.
- [ ] **No backend change** — no endpoint, controller, service, DTO, permission or migration.
- [ ] **No status-breakdown counts** were added (rejected — no status filter exists and page size is 25).
- [ ] **No unread-notification tile** was added (rejected — `PortalHeader` already shows it).
- [ ] `apps/portal/src/components/portal/portal-header.tsx` is **not modified**.
- [ ] `apps/portal/src/lib/ticket-badges.ts` is **not modified**.
- [ ] No `apps/web` file and no `packages/ui` file changed; no new dependency.
- [ ] `portal-home-view.spec.tsx` covers loading/error/empty/populated for both panels, the 5-row cap (proved with 7 items), and panel independence.
- [ ] `home/loading.spec.tsx` and `portal-header.spec.tsx` pass unmodified.
- [ ] Portal suite green; web suite green; typecheck, lint and build green.
