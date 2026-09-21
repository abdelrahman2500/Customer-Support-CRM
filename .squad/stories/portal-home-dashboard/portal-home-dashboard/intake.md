> **Source:** manual entry (tracker skipped via `--no-tracker`).
> Active tracker for this workspace: `github` — this story is not linked. 
> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/portal-home-dashboard/portal-home-dashboard/intake.md`
- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.
- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

- **Feature name (display):** Portal Home — real authenticated landing page
- **Feature slug (folder under `plans/`):** `portal-home-dashboard`

## Tracker (metadata only)

- **Tracker type:** `github`
- **Work item id:** *(none — `squad new-story portal-home-dashboard` was refused because `naming.includeTrackerId` is true and no id was supplied; created via the established `--no-tracker` fallback, the same path Story 135's intake records)*
- **Work item type:** `Story` — product gap
- **Status:** `Planned`
- **Assignee:** `(unassigned)`
- **Labels:** `portal`, `product-gap`, `no-new-backend`

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

*(Paste the work item title verbatim. Prefilled when `squad new-story` fetched from a tracker.)*

```
Portal Home dashboard
```

---

## Description

*(Paste the full work item description. Prefilled when fetched from a tracker.)*

```
Approved from the post-Story-135 §2 recon at commit f9276c6.

THE GAP, MEASURED AT f9276c6

apps/portal/src/app/[locale]/(customer)/home/page.tsx is 28 lines. Its
entire body is one sentence and one link:

    <p>{t("placeholder")}</p>
    <Link href={`/${locale}/tickets`}>{t("myTicketsLink")}</Link>

The i18n key is literally named "placeholder", and its value is:

    en: "This page confirms you're securely signed in."
    ar: "هذه الصفحة تؤكد فقط أنك مسجّل الدخول بأمان."

This is NOT a minor screen. It is the canonical landing page for every
authenticated portal customer:

  - apps/portal/src/app/[locale]/page.tsx redirects to /{locale}/home
  - PortalHeader's `signedInAs` link points at /{locale}/home
  - (customer)/layout.tsx's SSR auth guard lands here after login

So it is the first thing every customer sees, every session, and it tells
them nothing they did not already know. Meanwhile the portal has four real
destinations (tickets, knowledge base, chat, notifications) and the API
already returns everything a useful landing page needs.

This is an UNFINISHED PLACEHOLDER, not a deliberate design decision.
Discovery found no plan, doc comment, or story anywhere in .squad/** that
declares the portal home intentionally minimal — unlike, say,
apps/portal/src/lib/ticket-badges.ts, whose duplication IS documented as
deliberate. Story 52's own comment calls this "the Customer Portal's first
authenticated page"; Story 53 added the single link. Nothing since.

GOAL

Replace the placeholder with the smallest coherent, genuinely useful
authenticated home experience, built ONLY on existing backend capabilities,
existing portal hooks/query keys, existing shared primitives and existing
i18n conventions.

This is a SCREEN-COMPLETION story, not a portal redesign.
```

---

## Acceptance criteria

*(Checklist, bullets, Gherkin, etc. Prefilled for Azure DevOps when the work item has acceptance criteria.)*

```
PLACEHOLDER REMOVED
- [ ] The `home.placeholder` message key is gone from BOTH
      apps/portal/messages/en.json and apps/portal/messages/ar.json, and no
      portal source file references it.
- [ ] apps/portal/src/app/[locale]/(customer)/home/page.tsx no longer
      renders placeholder copy.

REAL CONTENT FROM REAL EXISTING DATA
- [ ] The home page renders a ticket entry point driven by the EXISTING
      `useMyTicketsQuery()` — the accurate `total` from the paginated
      envelope, plus the most recent tickets from the first page (the API
      already orders `createdAt desc`, so "most recent" needs no new
      parameter).
- [ ] Each listed ticket shows its subject and status, links to the
      existing `/{locale}/tickets/{id}` detail route, and derives its
      status variant from the EXISTING
      apps/portal/src/lib/ticket-badges.ts `ticketStatusBadgeVariant` —
      that file is NOT modified.
- [ ] The home page renders a knowledge-base entry point driven by the
      EXISTING `usePublishedArticlesQuery()`, linking to the existing
      `/{locale}/knowledge-base/{id}` route.
- [ ] Clear navigation to the existing portal destinations is present; no
      new route is added and the existing route structure is unchanged.

STATES
- [ ] Loading, empty and error states are handled for every query the page
      introduces, following the conventions the sibling portal views
      already use (`Skeleton` for loading; `<Alert variant="destructive">`
      for error — the Story 135 convention; a quiet inline sentence for
      empty, matching the portal's existing empty-state voice).
- [ ] A failure of one panel does not prevent the other panel rendering.

I18N
- [ ] Every new user-visible string is added to BOTH en.json and ar.json
      under the existing `home` namespace, with real Arabic translation
      (never English pasted into ar.json).
- [ ] The i18n parity check still reports 0 keys missing in either
      direction for the portal.

RTL / RESPONSIVE / A11Y
- [ ] No raw physical-direction utility (ml-/mr-/pl-/pr-/left-/right-/
      text-left/text-right) is introduced anywhere — the portal currently
      has ZERO and must keep ZERO.
- [ ] Responsive behaviour is preserved: the page must not introduce
      horizontal page overflow at 390px width; long free-text values
      (ticket subjects, article titles) must wrap rather than force the
      page wide (follow `reports-view.tsx`'s documented
      `min-w-0 break-words` + `shrink-0` precedent).
- [ ] Existing accessibility behaviour is preserved: the
      `#main-content` skip-link target and heading order stay correct.

TESTS
- [ ] A spec covers the new home view's loading, error, empty and
      populated branches, following the existing portal component-spec
      conventions (vi.mock of the hook module, as
      ticket-list-view.spec.tsx does).
- [ ] The existing home/loading.spec.tsx still passes unmodified.
- [ ] The full portal suite stays green (301 tests / 41 files at f9276c6 —
      re-measure rather than assuming this is still current).

NON-REGRESSION (load-bearing)
- [ ] No new backend endpoint, controller, service, DTO or migration.
- [ ] No apps/web file changed.
- [ ] No packages/ui primitive implementation changed.
- [ ] apps/portal/src/components/portal/portal-header.tsx is NOT modified.
- [ ] No authentication, password, realtime, reporting or dark-mode work.
- [ ] No new dependency.
```

---

## Attachments

Place files in `attachments/` next to this `intake.md`, then list them here so the planner knows what to open.

None.

---

## Dependencies

- **Blocked by / related ids:** None. Story 135 (`f9276c6`) is complete and pushed; nothing blocks this story.
- **Depends on code areas or other stories:**
  - **Story 52** — created this page and `(customer)/layout.tsx`'s SSR auth guard. The guard is NOT touched.
  - **Story 53 / PORTAL-1** — `useMyTicketsQuery(page?)` and `myTicketsQueryKey(page)` in `apps/portal/src/hooks/use-portal-tickets.ts`; returns `PaginatedResponse<PortalTicketSummary>`.
  - **Story 54 / S-8c** — `usePublishedArticlesQuery(search?, locale?, page?)` in `apps/portal/src/hooks/use-portal-knowledge-base.ts`.
  - **Story S-5** — `ticketStatusBadgeVariant` in `apps/portal/src/lib/ticket-badges.ts`. **Consumed, never modified** (its cross-app duplication is deliberate and documented).
  - **Story 135 (`f9276c6`)** — established `<Alert variant="destructive">` as the portal's error surface and added the `RAW_ERROR_BOX` guard in `apps/portal/src/design-tokens.spec.ts`. New error UI must use `Alert`, or that guard fails.

## Extra notes (optional)

- Selected by the post-135 §2 recon as the only category-1 (real product/user-facing) candidate that is fully verifiable while Docker is unavailable. The other category-1 candidate (no self-service password management) needs API e2e to prove credential invalidation, which is currently blocked.
- Every roadmap gap-matrix item that is not externally blocked has already shipped (RM-00→RM-25 minus the provider-blocked RM-16/17/18), so this story comes from fresh recon rather than the roadmap.

## Technical hints (optional)

- Repos/roots: `.`. Primary language: `typescript`.

**Page/View convention (follow exactly).** Every other portal route is a
thin server page delegating to a client view:

    // tickets/page.tsx
    import { TicketListView } from "@/components/tickets/ticket-list-view";
    export default function TicketsPage() { return <TicketListView />; }

`home/page.tsx` is currently the exception — an `async` server component
using `getTranslations` from `next-intl/server`. Because the data hooks are
client-side React Query, the page should become the same thin server page
delegating to a new client view (e.g. `components/portal/portal-home-view.tsx`),
which uses `useTranslations`. `home/loading.tsx` already renders the shared
`RouteLoadingSkeleton` and must keep working.

**Existing endpoints and their exact shapes (verified at f9276c6):**

- `GET /portal/tickets` → `PaginatedResponse<PortalTicketSummary>`
  (`{items,total,page,pageSize,totalPages}`). Ordered
  `[{createdAt:"desc"},{id:"desc"}]` by
  `TicketsService.listTicketsForCustomer`. `DEFAULT_PAGE_SIZE` is 25.
  `PortalTicketSummary` carries `id, subject, categoryId, categoryName,
  priority, status, customerId, contactId, departmentId,
  assignedToUserId, createdAt, updatedAt`.
- `GET /portal/knowledge-base` → paginated published articles, via
  `usePublishedArticlesQuery`. Query key already includes `locale`.
- `GET /portal/notifications/unread-count` → `{unreadCount}` via
  `useUnreadNotificationCountQuery` — see "Investigated and excluded".

**Card styling.** `@crm/ui` exports `Card`/`CardHeader`/… but **zero files
in either app use them**. The established convention in both apps is the
inline string `rounded-md border border-rule bg-surface p-4` (13
occurrences in `apps/portal` alone). Match that; introducing `Card` here
would be a design-system adoption story, which this one is not.

**Test convention.** Mirror `ticket-list-view.spec.tsx`: `vi.mock` the hook
module and drive `isLoading`/`isError`/`isSuccess` branches. Portal specs
assert on translation KEYS (e.g. `"list.error"`), not English copy, because
the test i18n setup returns the key.

## Out of scope

- What this story explicitly does **not** cover:
  - **No new backend endpoint, controller, service, DTO, permission or migration.**
  - **No ticket status-count summary** — investigated and excluded, see below.
  - **No unread-notification tile on the home page** — investigated and excluded, see below.
  - **No `PortalHeader` change** and no language-switcher migration.
  - **No authentication or session redesign**; `(customer)/layout.tsx`'s SSR guard is untouched.
  - **No password-reset / change-password work** (that is a separate, separately-scoped candidate).
  - **No global design-system refactor**, no `Card` adoption, no `QueryStateCard`/`EmptyState` migration (DS-D).
  - **No dark mode.**
  - **No reporting or chart changes.**
  - **No `apps/web` changes.**
  - **No realtime architecture changes** — the home page adds no new socket subscription.
  - **No new route**, and no change to the existing portal navigation structure beyond linking to routes that already exist.
  - **No new dependency and no new paid/external service.**
  - **No change to `apps/portal/src/lib/ticket-badges.ts`.**

---

## Investigated and excluded

### 1. Ticket status breakdown ("3 open, 2 resolved") — EXCLUDED, cannot be computed honestly

**DECIDED: out of scope. Not deferred within this story.**

A status-count tile was an obvious candidate for the "concise ticket
summary" idea. Discovery proves it cannot be built correctly on existing
capabilities:

1. `ListPortalTicketsQueryDto` accepts **only** `page` and `pageSize`.
   `portal-tickets.controller.ts`'s own doc comment states it outright:
   *"no other filters exist for this list"*. There is no status filter.
2. `DEFAULT_PAGE_SIZE` is **25**. Counting statuses client-side from the
   first page would therefore be silently **wrong** for any customer with
   more than 25 tickets — it would under-report, with no indication.
3. Fetching every page to count client-side is not acceptable either: it
   turns one landing-page render into N requests and still races.

Making this correct needs either a status filter on the existing endpoint
or a new counts endpoint — **a new backend capability**, which this
story's hard boundary forbids. It is therefore removed rather than
approximated.

**What is used instead:** the envelope's `total` (accurate by construction
— `paginate()` counts every matching row regardless of page) and the most
recent tickets from page 1 (correct by construction — the API already
orders `createdAt desc`). Both are honest with zero backend change.

**If a status breakdown is wanted, it is a separate story** that first
decides whether to add a filter or a counts endpoint.

### 2. Unread-notification tile — EXCLUDED as redundant

`useUnreadNotificationCountQuery()` exists and works, but
`PortalHeader` **already renders the unread count as a badge on the
notifications nav link, on every authenticated page**
(`portal-header.tsx` lines ~85–86 and ~152–155). A second unread count on
the home page would repeat the same number a few centimetres below the
header that already shows it, and would add a second subscriber to the
same query for no new information.

Excluded as duplication, not because the capability is missing. The
existing header badge remains the single place unread count is surfaced.

---

## Resolved decisions (approved before planning)

### 1. Content counts — RESOLVED: 5 and 5

- **Recent tickets: exactly 5.**
- **Knowledge-base articles: exactly 5.**

Both are a **bounded home-page preview, never a replacement for the full
listings** — each panel links on to its existing full screen
(`/{locale}/tickets`, `/{locale}/knowledge-base`), which keep their own
pagination.

Both counts are taken by slicing the **already-fetched first page** of the
existing queries (`useMyTicketsQuery()` and `usePublishedArticlesQuery()`,
whose `DEFAULT_PAGE_SIZE` is 25). No extra request, no new query
parameter, and **no backend endpoint**. A customer with fewer than 5 of
either simply sees fewer rows.

### 2. Welcome copy — RESOLVED: short, useful, non-duplicating

- The home page renders a **short localized welcome/context heading plus
  one line of supporting copy**.
- It must **NOT repeat `PortalHeader`'s existing `home.signedInAs`
  ("Signed in as {name}")** content — the header already shows the
  contact's name on every authenticated page, and `PortalHeader` is not
  modified by this story.
- It must **not invent profile or business data** (no company name, no
  account tier, no "last login", no ticket-health verdict) and must **not
  introduce any new backend data**.
- The copy orients the customer toward what this page offers and what they
  can do next, using only what the page already renders.
- All copy follows the existing i18n conventions under the `home`
  namespace, with **en/ar parity** and real Arabic translation.
