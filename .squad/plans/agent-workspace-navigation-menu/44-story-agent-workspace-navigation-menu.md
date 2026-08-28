# Story 44 — Agent Workspace: Persistent Navigation Menu

## Prerequisites

- Every existing top-level Agent Workspace screen this story links to: `dashboard` (Story 28), `tickets` (Story 23), `customers` (Story 26), `sla-policies` (Story 31), `business-hours` (Story 33), `users` (Story 32/38), `roles` (Story 34), `audit-logs` (Story 40), `notifications` (Story 39) — all already implemented, routed, and reachable by URL today.
- `agent-workspace-session-refresh` Story 41: the current `WorkspaceNav`/`workspace-nav.spec.tsx` this story extends (sign-out/session-refresh logic, unmodified by this story).
- **Product decision** (recorded in this session, prior to this plan): the repeated "no persistent navigation menu" deferral carried by every prior Agent Workspace story's plan is explicitly reversed. This story executes that decision; it does not make it.

---

## Story Goal

Give every already-implemented, already-URL-reachable Agent Workspace screen a persistent, always-visible navigation link from every other screen — replacing "type the URL" as the only way to reach 8 of the workspace's 9 top-level screens (only `tickets`, via the existing app-name link, has ever had an in-chrome entry point).

**Confirmed this planning pass** (not assumed): `apps/web/src/components/workspace/workspace-nav.tsx` today renders exactly two interactive elements — an app-name link to `/tickets` and a sign-out button — and nothing else. No other screen has a persistent link to it anywhere in the chrome.

**Not in scope**: any new backend endpoint/DTO/permission (none needed — confirmed below), any client-side permission-based hiding of nav links (no such pattern exists anywhere in this codebase — see Design item 3), active-page highlighting (no `usePathname`/`<Link>`/`aria-current` precedent exists anywhere in `apps/web/src` — see Design item 4), any change to `(agent)/layout.tsx` or any individual screen, and no README changes (per explicit product instruction, left for a future documentation-capable story).

---

## Context — Read These Files First

1. `apps/web/src/components/workspace/workspace-nav.tsx` — the single file this story extends. Current shape: a `<header>` with an app-name `<a>` (hardcoded to `/${locale}/tickets`) on the left, and "signed in as" text + sign-out `Button` on the right. Uses `useTranslations("workspace")`, `useParams<{ locale: string }>()`, `useRouter()`.
2. `apps/web/src/app/[locale]/(agent)/layout.tsx` — renders `<WorkspaceNav user={user} />` as one child of a `flex min-h-screen flex-col` container, alongside `<main>` and `<BranchNotifications>`. Confirmed this planning pass: `WorkspaceNav` returning more than one top-level element (e.g. a header + a nav bar) composes correctly here with **zero change to this file** — each becomes its own row in the existing flex-col layout.
3. `apps/web/src/components/workspace/workspace-nav.spec.tsx` — existing test conventions this story's new tests extend: mocks `next/navigation` (`useParams`, `useRouter`), `next-intl` (a trivial `t(key) => key` mock), and `@/lib/api` (`logout`, `clearAccessToken`).
4. Every top-level screen's own page-title source, confirmed this planning pass by reading each component and `apps/web/messages/en.json`:

   | Screen | Route | Title i18n key | English string |
   |---|---|---|---|
   | Dashboard | `dashboard` | `dashboard.title` | "Dashboard" |
   | Tickets | `tickets` | `tickets.list.title` | "Tickets" |
   | Customers | `customers` | `customers.list.title` | "Customers" |
   | SLA Policies | `sla-policies` | `slaPolicies.list.title` | "SLA Policies" |
   | Business Hours | `business-hours` | `businessHours.title` | "Business Hours" |
   | Users | `users` | `users.list.title` | "Users" |
   | Roles & Permissions | `roles` | `roles.title` | "Roles & Permissions" |
   | Audit Log | `audit-logs` | `auditLogs.title` | "Audit Log" |
   | Notification History | `notifications` | `notificationHistory.title` | "Notification History" |

   These are the only **top-level** (list/landing) routes under `(agent)/`; `tickets/new`, `tickets/[id]`, `customers/new`, `customers/[id]`, `sla-policies/new`, `users/new` are create/detail sub-screens reached via in-page buttons from their parent list, exactly as today — not nav-menu targets.
5. `apps/api/prisma/seed.ts` (lines 19-45) — confirmed this planning pass: only two roles are seeded, `SuperAdmin` (granted every permission) and `Agent` (granted **zero** permissions — an empty array, not a subset). This means, as the repository stands today, a logged-in Agent-role user's primary data fetch on all 9 linked screens would 403 — this is a pre-existing seed-data characteristic this story does not create and is not responsible for fixing (see Design item 3 and Edge Cases).
6. Confirmed this planning pass via a full search of `apps/web/src`: **no existing use of `usePathname`, `next/link`'s `<Link>`, `aria-current`, or any client-side role/permission-gating pattern** anywhere in the codebase. Every existing internal navigation link in this app (the app-name link in `workspace-nav.tsx`, "Create a new customer instead" in `create-ticket-view.tsx`, "New ticket" in `customer-detail-view.tsx`, etc.) is a plain `<a href=...>`; every route change originating from a click handler uses `useRouter().push(...)`. This story's new links follow the plain-`<a>` convention, matching 100% of existing precedent — not `<Link>`, which would be a new import unused anywhere else in this app.

---

## Design (resolved during this planning pass)

1. **`WorkspaceNav` returns a `<header>` (unchanged) plus a new sibling `<nav>` row, via a Fragment — not a restructure of the existing header.** The existing header's app-name link, "signed in as" text, and sign-out button are untouched, in the same order, same styling. A new `<nav>` element is added directly below it as a second horizontal bar. Confirmed (Context item 2) that `(agent)/layout.tsx` needs no change for this — it already just renders `<WorkspaceNav user={user} />` inside a flex-col container, so a second top-level row composes automatically.
2. **Nine plain `<a href={...}>` links, one per top-level screen, in a single `flex flex-wrap gap-4` row** — mirroring the existing app-name link's exact tag/pattern (Context item 6), not `next/link`. `flex-wrap` (not a hamburger/drawer/mobile menu) is the deliberately minimal answer to "nine links might not fit one line on a narrow viewport" — introducing a collapsible/drawer navigation pattern would be new architecture this story does not take on (see Non-Goals). `gap-4` (not `ml-*`/`mr-*`) keeps the row RTL-correct for free, exactly matching every existing spacing convention in this file and its siblings.
3. **All nine links always render, for every authenticated user, unconditionally — no client-side permission-based hiding.** Confirmed (Context items 5-6) that: (a) no client-side role/permission-gating pattern exists anywhere in this codebase today, and (b) the seeded `Agent` role has zero permissions, so there is no real per-permission signal to key visibility off even if this story wanted to. Building one now would be new authorization logic invented for this story alone, contradicting the explicit instruction not to introduce new authorization logic unless the repository already requires it — it doesn't. This matches the app's own established, repository-wide convention (seen in `TicketDetailView`, `AuditLogView`, etc.): the frontend never pre-empts a permission decision, it always attempts the real request and renders whatever the backend's real 403 (or success) produces. A user who lacks a given screen's read permission will see that screen's own, already-existing 403/forbidden state after clicking its nav link — not a hidden link.
4. **No active-page highlighting.** Confirmed (Context item 6) that `usePathname` and `aria-current` have zero precedent anywhere in this app. Adding either would be a genuinely new pattern, not an extension of one — out of scope for "the smallest coherent navigation scope." The nav is a flat, stateless list of destinations, exactly matching the visual weight and behavior of the one link (`appName` → `/tickets`) that already exists today.
5. **Labels are a small, dedicated `workspace.nav.*` i18n block — not cross-namespace lookups of each screen's own title key.** Each of the nine strings below is the exact same English/Arabic wording as that screen's own established title (Context item 4), so there is no new translation *decision* being made, only a new namespace location for the same word/phrase — consistent with this app's existing convention of every screen owning its own translation keys (no screen currently reaches into another namespace for a string). A tenth key, `workspace.nav.label`, supplies an `aria-label` for the `<nav>` element itself, mirroring the exact existing precedent of `notifications.regionLabel` (an aria-label sourced from i18n) already used by `NotificationToaster`.
6. **Order**: Dashboard, Tickets, Customers, SLA Policies, Business Hours, Users, Roles & Permissions, Audit Log, Notification History — day-to-day operational screens first (dashboard/tickets/customers/SLA/business-hours), then administrative/oversight screens (users/roles/audit/notifications). A reasonable default, not a decision requiring product sign-off; trivially reorderable later since it's a static array.

---

## Implementation Tasks

### 1 — `apps/web/src/components/workspace/workspace-nav.tsx` (modify)

- Add a `NAV_ITEMS` static array (module scope, outside the component) of nine `{ href: string; labelKey: string }` entries per the table in Context item 4 / Design item 6, e.g.:
  ```ts
  const NAV_ITEMS = [
    { href: "dashboard", labelKey: "nav.dashboard" },
    { href: "tickets", labelKey: "nav.tickets" },
    { href: "customers", labelKey: "nav.customers" },
    { href: "sla-policies", labelKey: "nav.slaPolicies" },
    { href: "business-hours", labelKey: "nav.businessHours" },
    { href: "users", labelKey: "nav.users" },
    { href: "roles", labelKey: "nav.roles" },
    { href: "audit-logs", labelKey: "nav.auditLogs" },
    { href: "notifications", labelKey: "nav.notifications" },
  ] as const;
  ```
- Wrap the existing `return (...)` in a Fragment (`<>...</>`), keeping the existing `<header>` exactly as-is.
- Add a `<nav aria-label={t("nav.label")} className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-6 py-2 text-sm text-slate-600">` sibling below the header, mapping `NAV_ITEMS` to `<a key={item.href} href={`/${locale}/${item.href}`} className="hover:text-slate-900 hover:underline">{t(item.labelKey)}</a>`.
- No change to `handleSignOut`, the app-name link, or any existing prop/import beyond what's needed for the above (no new imports required — `useTranslations`/`useParams` are already imported).

### 2 — i18n

New keys under the existing `workspace` namespace in `apps/web/messages/{en,ar}.json` (additive only — `appName`/`signedInAs`/`signOut` untouched):

| Key | English | Arabic |
|---|---|---|
| `nav.label` | "Workspace navigation" | "التنقل في مساحة العمل" |
| `nav.dashboard` | "Dashboard" | "لوحة التحكم" |
| `nav.tickets` | "Tickets" | "التذاكر" |
| `nav.customers` | "Customers" | "العملاء" |
| `nav.slaPolicies` | "SLA Policies" | "سياسات اتفاقية مستوى الخدمة" |
| `nav.businessHours` | "Business Hours" | "ساعات العمل" |
| `nav.users` | "Users" | "المستخدمون" |
| `nav.roles` | "Roles & Permissions" | "الأدوار والصلاحيات" |
| `nav.auditLogs` | "Audit Log" | "سجل التدقيق" |
| `nav.notifications` | "Notification History" | "سجل الإشعارات" |

(Every value above is the exact existing wording already used by that screen's own title key — confirmed by direct lookup this planning pass, not translated fresh.)

### 3 — Tests (`workspace-nav.spec.tsx`, modify — extend the existing file, same conventions)

- New test: renders a link for each of the nine `NAV_ITEMS`, each `getByRole("link", { name: "nav.<labelKey>" })` (per the existing `t(key) => key` mock convention already used in this file) has `href="/en/<route>"`.
- New test: the existing app-name link, "signed in as" text, and sign-out button are all still present and unchanged (a light regression check specific to this file, since its render output is changing shape).
- Existing three sign-out tests (renders app name/signed-in-as, calls-logout-then-cleans-up, still-cleans-up-on-logout-rejection, awaits-logout-before-cleanup) require **no modification** — same mocks, same assertions, same behavior.

---

## Edge Cases & Failure Modes

- **An authenticated user's role lacks the permission a given nav destination's data needs** (true for the seeded `Agent` role against all nine screens today — Context item 5): clicking that link navigates there and the screen renders its own already-existing 403/forbidden state (e.g. `AuditLogView`'s `t("forbidden")`, `NotificationHistoryView`'s `t("forbidden")`) — unchanged, pre-existing behavior. The nav menu itself never blocks or hides the click. This is a pre-existing seed-data/permission-model characteristic, not something this story introduces or must resolve.
- **Narrow viewport**: the nav row wraps (`flex-wrap`) rather than overflowing or requiring horizontal scroll — no drawer/hamburger menu is introduced.
- **RTL (`ar` locale)**: the nav row uses `gap-4` (not directional margins), so it mirrors correctly under `dir="rtl"` with zero extra code, exactly like every existing spacing convention elsewhere in this file and its siblings.

---

## Test Plan

1. **Unit/component**: as listed in Implementation Task 3 — extends the existing `workspace-nav.spec.tsx`; all four existing tests remain green, unmodified.
2. **Regression**: full existing `apps/web` suite remains green — this story modifies exactly one existing component, its spec, and two message files. No other component imports or depends on `WorkspaceNav`'s internal structure beyond `(agent)/layout.tsx`, which only renders `<WorkspaceNav user={user} />` and is unaffected by what that component internally returns. `apps/api`/`apps/worker` unaffected — run for confirmation only.

---

## Migration / Rollback

None. No Prisma schema or migration change, no backend file touched at all. Rollback is a plain code revert of `workspace-nav.tsx`, its spec, and the two message files.

---

## Verification Steps

1. `pnpm --filter @crm/web typecheck`, `lint`, `build`; workspace-wide `pnpm typecheck`/`lint`/`build`.
2. `pnpm --filter @crm/web test`; `pnpm --filter @crm/api test`; `pnpm --filter @crm/worker test` (regression only).
3. Live infra (if available): log in as the seeded SuperAdmin, confirm all nine real routes are reachable via the new nav links and each real screen loads its real data as it already does today (no behavior change to any destination screen).
4. `pnpm --filter @crm/api test:e2e` — regression only (no backend file touched).
5. Hygiene: `git status`; confirm `apps/api/**`, `schema.prisma`, migrations, `(agent)/layout.tsx`, every screen's own component file, and `README.md` all have empty diffs.
6. Browser/DOM verification: not claimed unless an actual browser automation capability is available.

## Done Criteria

- [ ] Every one of the nine top-level Agent Workspace screens (dashboard, tickets, customers, sla-policies, business-hours, users, roles, audit-logs, notifications) has a persistent, always-visible link in the workspace chrome, present on every authenticated page.
- [ ] Each link navigates to the correct, unchanged, existing route (`/${locale}/<route>`) — no route added, removed, or renamed.
- [ ] The existing app-name link and sign-out button/behavior (Story 41) are completely unchanged.
- [ ] No client-side permission-based hiding of any link; no active-page highlighting.
- [ ] No new backend endpoint, DTO field, permission, Prisma model, migration, or authorization logic.
- [ ] No change to `(agent)/layout.tsx` or any individual screen's own component/page file.
- [ ] No README change.
- [ ] English and Arabic translations exist for every new string, each matching that screen's own already-established title wording; RTL preserved via `gap-*` spacing.
- [ ] Unit/component tests exist and pass for the new nav row; all four existing `workspace-nav.spec.tsx` tests remain green, unmodified.
- [ ] Typecheck/lint/build clean, workspace-wide.
- [ ] `git status` shows no unrelated changes after implementation.

---

## Non-Goals (explicit)

- Any backend change, any new endpoint, any new permission, any new Prisma model.
- Client-side permission-aware showing/hiding of nav links (no repository precedent; the seeded `Agent` role has no permissions to key such logic off anyway).
- Active-page highlighting / `usePathname` / `next/link`'s `<Link>` (zero precedent anywhere in this codebase — a genuinely new pattern, not this story's smallest-coherent-scope mandate).
- A responsive hamburger/drawer mobile navigation pattern (a `flex-wrap` row is the deliberately minimal answer to narrow viewports).
- Any change to `(agent)/layout.tsx`, any individual screen, or any backend file.
- README changes of any kind (explicit product instruction: left for a future documentation-capable story, not this one).
- Deciding or starting the next major product phase (Customer Portal/Channels, Admin self-service, Automatic assignment, Agent Dashboard depth, Reports, Knowledge Base/AI) — explicitly deferred to a fresh recon after this story.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
