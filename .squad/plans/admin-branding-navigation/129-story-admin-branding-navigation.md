# Story 129 — Admin Branding & Navigation Layout Customization

## Prerequisites

- **Story 62 completed** — [`../admin-branch-branding/62-story-admin-branch-branding.md`](../admin-branch-branding/62-story-admin-branch-branding.md). Shipped the `BrandingConfig` model (`admin` schema, `branchId @unique`), `BrandingService`/`BrandingController` (`GET`/`PATCH /branding`, `branding:read`/`branding:update`), `apps/web/src/lib/branding-api.ts`, `apps/web/src/hooks/use-branding.ts`, and `BrandingView`. **This story extends that row and that screen — it does not create a second persistence mechanism.**
- **Story 82 completed** — [`../admin-branch-branding-live-consumption/82-story-branding-live-consumption.md`](../admin-branch-branding-live-consumption/82-story-branding-live-consumption.md). Shipped `BrandingService.getBrandingForBranch(branchId)`, `GET /portal/branding`, and live logo/`primaryColor` consumption in `WorkspaceNav` and `PortalHeader`.
- **Story 44 + RM-11 + Batch 3 + "Workspace Navigation UX audit" completed** — the current `WorkspaceNav` (`apps/web/src/components/workspace/workspace-nav.tsx`, 591 lines): six named `NAV_GROUPS`, per-item `LucideIcon`, `NavItemLabel`, a mobile hamburger `DropdownMenu` below `sm`, and a grouped desktop `<nav>`.
- **RM-23 completed** — `apps/web/src/components/settings/settings-view.tsx`, the consolidated `Tabs` settings screen (`branding` / `ai` / `businessHours`). This is the "existing Admin settings architecture" the intake asks to extend.
- **Story S-1 / DS-1a / DS-1b completed** — the semantic token layer in `packages/config/tailwind-tokens.css` (`--surface`, `--ink*`, `--rule*`, `--accent*`, `--focus`, `.focus-ring`). Both new navigation variants use these tokens; **no raw `slate-*` class may be introduced.**
- **Story 114 completed** — `apps/e2e` (Playwright), `apps/e2e/tests/support/api-client.ts`'s `loginAsAdmin()` fixture-seeding helper.

**Note on the stray plan folder:** `.squad/plans/navigation-layout-customization/` and `.squad/stories/navigation-layout-customization/admin-branding-navigation-layout-customization/` exist on disk (untracked) from a `squad new-story` run under a different slug; only the intake there has content — its `00-overview.md` is an unfilled template. This story's plan lives under the intake's own declared slug, `admin-branding-navigation`. Leave the stray folder as-is (the same treatment `00-index.md` already gives `slabusiness-hours-awaretargetcomputation` and `test`).

---

## Story Goal

Let a branch admin configure the application's brand identity **and** choose how the Agent Workspace presents its navigation, from the existing Settings screen, persisted in the existing `BrandingConfig` row — no rebuild, no redeploy, no new persistence mechanism.

1. **Brand identity gains a name.** `BrandingConfig` gains `appName` alongside `logoUrl`/`primaryColor`/`secondaryColor`. When set, it replaces the hard-coded `workspace.appName` i18n string everywhere the app currently prints its own name; when unset, the existing translated default is used verbatim.
2. **Navigation gains a layout setting.** `BrandingConfig` gains `navigationLayout` (`SIDEBAR` | `NAVBAR`, resolving to `NAVBAR` when unset — the current presentation, so every existing branch is unchanged on upgrade).
3. **Two first-class presentations over one navigation source of truth.** `NAV_GROUPS`, `NavLinkItem`, `NavGroup`, `NavItemLabel` and the active-route rule move out of `workspace-nav.tsx` into one shared module that both variants import. Neither variant re-declares a route, a label key, an icon, or a permission rule.
   - **Navbar** — a horizontal top bar where each of the six groups is a `DropdownMenu` trigger, so the item count never forces the bar to wrap or overflow.
   - **Sidebar** — a persistent vertical rail beside the content, with group headings, its own scroll container, and a collapse-to-icons toggle.
4. **The layout is applied at the shell level**, so it is consistent across every `(agent)` route, and resolved **server-side** on first paint so there is no layout flash.

**Not in scope** (each is an intake "Out of scope" item, or a deliberate deferral):

- Adding client-side permission gating to navigation. **There is none today** — `workspace-nav.tsx` ~lines 67–75 document why (`the seeded Agent role has zero granted permissions today, so there is no real per-permission signal to key visibility off`); a screen the session lacks permission for renders its own 403 after navigation. "Permission-based navigation visibility must continue to work exactly as it does today" therefore means **preserve that behaviour unchanged in both variants**, not introduce gating. Introducing it here would be a new authorization model, explicitly out of scope.
- Pointing `--accent` (or any other token) at `primaryColor`. `packages/config/tailwind-tokens.css` ~lines 62–72 names that as a *future* story's job ("Story S-15"); doing it here would silently recolour every button in the app and carries a real contrast risk with an arbitrary admin-chosen hex.
- Any change to `apps/portal`'s navigation, `PortalHeader`, or `apps/portal/src/lib/branding-api.ts`. The portal keeps its own narrower `BrandingSummary` declaration and simply ignores the two new API fields.
- Logo file upload, per-department branding, custom CSS/JS/HTML injection, dark mode, per-user navigation preference (the setting is branch-level and admin-controlled, per the intake's own "Extra notes").
- Any change to `[locale]/layout.tsx` (the `dir`/`lang` RTL root) in either app.

---

## Context — Read These Files First

1. `apps/web/src/components/workspace/workspace-nav.tsx` — the whole 591-line file, but especially:
   - **~lines 66–214** — the accumulated doc comment. It records every prior decision this story must not silently undo: no client-side permission gating (~67–75), no `uppercase`/`tracking-wide` on group labels because Arabic has no case distinction and letter-spacing breaks connected letterforms (~194–201), the `border-s-2 border-transparent` reserved-border active treatment (~202–206), and — read this one carefully — **"No sidebar, no collapse state, no second route-loading mechanism… See this batch's own final report for why a sidebar was considered and declined"** (~210–214). This story supersedes that specific decision **only because an admin now opts into it explicitly**; the navbar default is unchanged.
   - **~lines 215–285** — `NavLinkItem`, `NavGroup`, `NAV_GROUPS` (six groups, 20 items). This is the block being extracted verbatim.
   - **~lines 287–320** — `NavItemLabel`, the one shared render path for icon + label + unread badge.
   - **~lines 323–424** — the component body: `useBrandingQuery()`, `useUnreadNotificationCountQuery()`, `useMentionNotifications(user.id)`, `useRealtimeConnectionIssue()`, `useMyBranchMembershipsQuery()`, and the three handlers `handleSignOut` / `handleSwitchBranch` / `handleSwitchLocale`. **Every one of these moves to the shared header, unchanged.**
   - **~lines 426–487** — the `<header>`: the `--brand-primary` inline style, the `border-[var(--brand-primary,rgb(var(--rule)))]` border, the logo-vs-`appName` conditional (~434, ~437), the "signed in as" text, the branch `<select>`, the language `<select>`, and the sign-out `Button`.
   - **~lines 488–498** — the `connectionIssue` banner.
   - **~lines 499–533** — the RM-11 mobile hamburger `DropdownMenu`, hidden at `sm` and up.
   - **~lines 534–588** — the desktop `<nav>`: one row per group, a `w-36` group label, wrapped items, and the `isActive` rule ``pathname === href || pathname?.startsWith(`${href}/`)`` (~lines 560–565, with Story 96's comment explaining why it is not exact equality).
2. `apps/web/src/app/[locale]/(agent)/layout.tsx` (whole file, 69 lines) — the server component that guards auth, renders the `skip-link` (~41–43), `<WorkspaceNav user={user} />` (~44), and `<main id="main-content" className="flex-1 p-6">` with a `max-w-screen-2xl` wrapper (~56–58). This is where the sidebar's row/column shell has to be introduced.
3. `apps/web/src/lib/auth-server.ts` (whole file, 32 lines) — `fetchCurrentUser()`: reads `ACCESS_TOKEN_COOKIE` via `cookies()`, `fetch`es `${getApiBaseUrl()}/auth/me` with `cache: "no-store"`, returns `null` on *any* failure. **The exact shape `fetchBranding()` mirrors.**
4. `apps/api/src/modules/admin/branding.service.ts` (whole file, 83 lines) — `BrandingSummary` (~6–10), `DEFAULT_BRANDING` (~12–16), `getBranding()` (~43–46), `getBrandingForBranch()` (~48–51), `updateBranding()`'s upsert (~53–70), and the local `toSummary()` helper (~73–83). All five change shape.
5. `apps/api/src/modules/admin/dto/update-branding.dto.ts` (whole file) — `@IsOptional()` + `@IsUrl()`/`@Matches(HEX_COLOR_PATTERN)`. The two new fields are added here in the same style.
6. `apps/api/prisma/schema.prisma` **lines 299–311** — the `BrandingConfig` model. Note `@@schema("admin")` and the `@map`-to-snake_case column convention. And **lines 1694–1708** (`enum ReportWidgetType`) — the precedent for declaring a Prisma enum with its own `@@schema(...)` under this repo's `multiSchema` datasource (lines 15–19).
7. `apps/web/src/components/admin/branding-view.tsx` (whole file, 180 lines) — `BrandingView`'s `isLoading`/`isError`/`isSuccess` split (~28–45) and `BrandingForm`'s draft state (~58–61), `useEffect` re-sync (~66–70), `handleSubmit` with `showSuccessToast` + `useErrorMessage` (~72–90), the per-field validity gate on the submit button (~92–99, ~135–143), and the preview panel (~147–177). The new fields join this form and follow all of it.
8. `apps/web/src/components/settings/settings-view.tsx` (whole file, 63 lines) — the `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` composition and `dir={localeDirection(locale)}` (~45). Note **line 42's `text-slate-900`** — a pre-S-1 leftover; leave it alone (out of scope).
9. `apps/web/src/components/workspace/workspace-nav.spec.tsx` (whole file, 802 lines) — the mock set every new nav spec must reproduce: `next/navigation` with mutable `pathname`/`locale` (~lines 14–24), the `next-intl` key-echo `useTranslations` (~26–29), the `importOriginal` partial mock of `@/lib/api` (~31–41), and the five hook mocks (~44–76).
10. `packages/config/tailwind-tokens.css` — the token vocabulary both variants must use, and `.focus-ring` / `.focus-ring-always` (~lines 202–214). `.focus-ring-always` is the one to use on Radix-driven triggers.
11. `packages/ui/src/lib/icons.ts` **~lines 72–97** — the "Workspace navigation" icon block. `MenuIcon`/`CloseIcon`/`ChevronDownIcon` already exist; the sidebar collapse toggle needs one more role-named export. Read ~lines 30–41 first — the direction rule for directional glyphs.
12. Grep for `t("appName")` and `"appName"` across `apps/web/src` to find every current consumer of the hard-coded application name before adding the override.
13. `apps/e2e/tests/agent-resolves-ticket.spec.ts` (whole file, 48 lines) — the login-then-drive-the-browser shape the new e2e spec mirrors, including the `test.use({ baseURL: "http://localhost:3000" })` line (~13).

---

## Product rules (from story)

| Concern | Current behaviour | New behaviour |
|---|---|---|
| Application name | Hard-coded `workspace.appName` i18n string ("Customer Support CRM" / the Arabic equivalent) | `BrandingConfig.appName` when set; the same i18n string when `null` |
| Navigation presentation | One fixed presentation: grouped, wrapped horizontal rows under the header | Admin-selected: `NAVBAR` (the default) or `SIDEBAR` |
| Where the setting lives | — | `BrandingConfig.navigationLayout`, edited on the existing Settings → Branding tab |
| Route/permission source | `NAV_GROUPS` inside `workspace-nav.tsx` | The same list, extracted to one shared module, imported by both variants |
| Permission-based visibility | None client-side; each screen renders its own 403 | **Unchanged** — both variants render the same full list |
| Mobile navigation | Hamburger `DropdownMenu` below `sm` | Unchanged mechanism, shared by both variants |

---

## Backend Tasks

### 1 — Schema: two new nullable columns + one enum

**File: `apps/api/prisma/schema.prisma`**

Add the enum next to the `admin`-schema models (mirroring `ReportWidgetType`'s own `@@schema` declaration at lines 1694–1708):

```prisma
/// Story 129 — the Agent Workspace's navigation presentation, chosen per
/// branch by an admin. `NAVBAR` is the presentation every branch already
/// had before this story, so an unconfigured branch (`null`) resolves to
/// it and renders unchanged.
enum NavigationLayout {
  SIDEBAR
  NAVBAR

  @@schema("admin")
}
```

Extend the model (currently lines 299–311) — **both fields nullable**, so there is no backfill and no behaviour change for an existing row:

```prisma
model BrandingConfig {
  id               String            @id @default(uuid())
  branchId         String            @unique @map("branch_id")
  branch           Branch            @relation(fields: [branchId], references: [id])
  appName          String?           @map("app_name")
  logoUrl          String?           @map("logo_url")
  primaryColor     String?           @map("primary_color")
  secondaryColor   String?           @map("secondary_color")
  navigationLayout NavigationLayout? @map("navigation_layout")
  createdAt        DateTime          @default(now()) @map("created_at")
  updatedAt        DateTime          @updatedAt @map("updated_at")

  @@map("branding_configs")
  @@schema("admin")
}
```

### 2 — Migration

Generate with `pnpm --filter @crm/api exec prisma migrate dev --name add_branding_app_name_and_navigation_layout`. The directory name must follow the existing `YYYYMMDDHHMMSS_snake_case` convention (see `apps/api/prisma/migrations/`, most recently `20260907230000_add_notification_template_locale`). The generated SQL must be **additive only**: one `CREATE TYPE "admin"."NavigationLayout"` plus two `ALTER TABLE "admin"."branding_configs" ADD COLUMN`. **Read the generated file and confirm it contains no `DROP`.**

### 3 — DTO

**File: `apps/api/src/modules/admin/dto/update-branding.dto.ts`**

```ts
@ApiProperty({ required: false })
@IsOptional()
@IsString()
@MaxLength(60)
appName?: string;

@ApiProperty({ required: false, enum: NavigationLayout })
@IsOptional()
@IsEnum(NavigationLayout)
navigationLayout?: NavigationLayout;
```

Import `NavigationLayout` from `@prisma/client` and add `IsEnum`, `IsString`, `MaxLength` to the existing `class-validator` import. **`MaxLength(60)`** is a deliberate cap — the name renders inside a fixed-width sidebar rail and a single-line navbar; without it an admin can paste a paragraph and break both. Do **not** add a `@Matches` pattern: a brand name is free text in both locales, including Arabic.

### 4 — Service

**File: `apps/api/src/modules/admin/branding.service.ts`**

- `BrandingSummary` gains `appName: string | null` and `navigationLayout: NavigationLayout | null`.
- `DEFAULT_BRANDING` gains both as `null`.
- `toSummary()`'s parameter type and returned object gain both fields.
- `updateBranding()`'s `create` block gains `appName: dto.appName ?? null, navigationLayout: dto.navigationLayout ?? null`; its `update` block gains the same two `!== undefined` conditional spreads the other three fields already use (lines 64–66).
- `getBranding()` / `getBrandingForBranch()` need **no logic change** — they already pass the whole row through `toSummary`.

**Do not** add a fallback-to-`NAVBAR` here. `null` means "not configured" all the way to the frontend, exactly like the other four fields; the single resolution point lives in Task 7.

### 5 — No controller change

`BrandingController` (`GET`/`PATCH /branding`) and `PortalBrandingController` (`GET /portal/branding`) both pass `BrandingSummary` straight through and need **no edit**. The portal response will now also carry `appName`/`navigationLayout`; `apps/portal/src/lib/branding-api.ts` declares its own narrower interface (lines 11–15) and simply ignores both. **Neither is a secret** — no permission change, no new permission; `branding:read`/`branding:update` already gate the agent surface.

---

## Frontend Tasks

### 6 — Extend the API client types

**File: `apps/web/src/lib/branding-api.ts`**

Add to `BrandingSummary`: `appName: string | null; navigationLayout: NavigationLayout | null;`. Add `appName?: string; navigationLayout?: NavigationLayout;` to `UpdateBrandingInput`. Declare the union locally — `apps/web` does not import `@prisma/client`:

```ts
export type NavigationLayout = "SIDEBAR" | "NAVBAR";
```

### 7 — The single source of truth for navigation

**Create file: `apps/web/src/components/workspace/nav-items.tsx`**

Move, **verbatim and unchanged**, from `workspace-nav.tsx`:

- the `NavLinkItem` / `NavGroup` interfaces (currently ~lines 215–224);
- `NAV_GROUPS` and its full accumulated doc comment (~lines 66–285) — **keep the comment**: it is the written record of every prior navigation decision, and losing it during the move is the single most likely way this story silently regresses one of them;
- `NavItemLabel` and its doc comment (~lines 287–320);
- the icon import block from `@crm/ui` that `NAV_GROUPS` needs.

Add exactly two new exports — the two rules that would otherwise be copy-pasted into each variant:

```tsx
/** Story 96's rule, extracted verbatim: a nested route (e.g.
 * `/en/tickets/ticket-1`) still marks its own top-level link current, so
 * this is a prefix match, not exact equality. The one active-route rule
 * both presentations share — an item cannot read as active in one
 * variant and inactive in the other. */
export function isNavItemActive(pathname: string | null, href: string): boolean {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

/** Resolves the configured layout to the one actually rendered. `null`
 * (no `BrandingConfig` row, an unconfigured field, a still-loading or
 * failed branding query) resolves to `NAVBAR` — the presentation every
 * branch had before Story 129, so nothing changes for a branch that
 * never touches the setting. */
export function resolveNavigationLayout(
  layout: NavigationLayout | null | undefined,
): NavigationLayout {
  return layout === "SIDEBAR" ? "SIDEBAR" : "NAVBAR";
}
```

`workspace-header.tsx`, `workspace-navbar.tsx` and `workspace-sidebar.tsx` all import from this module. **No route, label key, icon, or active-route rule may be declared anywhere else after this task.**

### 8 — Server-resolve branding so the shell does not flash

**Create file: `apps/web/src/lib/branding-server.ts`**

Mirror `auth-server.ts`'s `fetchCurrentUser()` exactly — same cookie read, same `cache: "no-store"`, same swallow-everything-and-return-`null`:

```ts
import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE, getApiBaseUrl } from "@/lib/api";
import type { BrandingSummary } from "@/lib/branding-api";

/** Story 129 — the navigation layout decides the page's own shell
 * (a row for `SIDEBAR`, a column for `NAVBAR`), so resolving it in a
 * client `useQuery` would paint one layout and then swap to the other on
 * every single page load. Read server-side here instead, in the same
 * request as `fetchCurrentUser()`, and handed to the shell as
 * `initialData`. Returns `null` on any failure — `resolveNavigationLayout`
 * treats that identically to "unconfigured", so a branding outage
 * degrades to the pre-Story-129 navbar rather than to a broken page. */
export async function fetchBranding(): Promise<BrandingSummary | null> {
  /* … same body shape as fetchCurrentUser, against `/branding` … */
}
```

**File: `apps/web/src/hooks/use-branding.ts`** — `useBrandingQuery` takes one optional argument so the shell can seed it without changing any existing call site:

```ts
export function useBrandingQuery(initialData?: BrandingSummary) {
  return useQuery({ queryKey: brandingQueryKey, queryFn: getBranding, initialData });
}
```

`BrandingView`'s existing no-argument call (`branding-view.tsx` line 21) is unaffected. **Note:** with `initialData` supplied, `isLoading` is `false` and `data` is defined on first render — `BrandingView` is the only consumer that branches on `isLoading` (line 28), and it never passes `initialData`, so its loading skeleton is unchanged.

### 9 — The shell

**Create file: `apps/web/src/components/workspace/workspace-shell.tsx`** (`"use client"`)

```tsx
export function WorkspaceShell({
  user,
  initialBranding,
  children,
}: {
  user: AuthenticatedUser;
  initialBranding: BrandingSummary | null;
  children: ReactNode;
}) { /* … */ }
```

- Calls `useBrandingQuery(initialBranding ?? undefined)` **once** — this is the only branding query in the shell; `WorkspaceHeader`, `WorkspaceNavbar` and `WorkspaceSidebar` all receive what they need as props rather than each opening their own query.
- `const layout = resolveNavigationLayout(brandingQuery.data?.navigationLayout);`
- Renders `<WorkspaceHeader … />` always, then branches:
  - `NAVBAR` → `<div className="flex min-h-screen flex-col">` → header → `<WorkspaceNavbar />` → `<main>`.
  - `SIDEBAR` → header → `<div className="flex flex-1">` → `<WorkspaceSidebar />` → `<main>`.
- `children` is a plain `ReactNode` prop, so the Server Components rendered by `(agent)/layout.tsx` stay server-rendered — passing server children through a client component is the supported App Router pattern and is what keeps this from turning every `(agent)` page into a client component.

**File: `apps/web/src/app/[locale]/(agent)/layout.tsx`** — the only changes: `const branding = await fetchBranding();` beside the existing `fetchCurrentUser()` call (line 31), and replacing lines 44–58 with

```tsx
<WorkspaceShell user={user} initialBranding={branding}>
  {children}
</WorkspaceShell>
```

The `skip-link` (lines 41–43), `BranchNotifications` (line 61) and `SuccessToaster` (line 66) stay exactly where they are, outside the shell. `<main id="main-content">` and its `max-w-screen-2xl` wrapper move **into** `WorkspaceShell` (each variant positions it differently relative to the nav) — the `id`, the classes, and the wrapper must be carried over unchanged so the skip link still lands and NAV-2's width cap still applies.

### 10 — The shared header

**Create file: `apps/web/src/components/workspace/workspace-header.tsx`** (`"use client"`)

Move `workspace-nav.tsx`'s `<header>` (~lines 426–487) and the `connectionIssue` banner (~488–498) here **unchanged**, along with the three handlers (`handleSignOut` ~348–357, `handleSwitchBranch` ~377–398, `handleSwitchLocale` ~405–420), `buildLocalePath` (~58–65), `LOCALES` (~51), and the hooks those need (`useMyBranchMembershipsQuery`, `useRealtimeConnectionIssue`, `useErrorMessage`, `useMentionNotifications`, `useNavigatingRouter`). Two edits only:

1. The brand block honours `appName`:

```tsx
const brandName = branding?.appName?.trim() || t("appName");
```

Used as the `<img alt>` **and** as the text link's content, replacing both current `t("appName")` uses (lines 434 and 437). `?.trim() ||` — not `??` — so an empty-string `appName` falls back like an absent one.

2. The mobile hamburger (~lines 499–533) moves here too, so one hamburger serves both variants. It keeps `sm:hidden`.

`branding` arrives as a prop from `WorkspaceShell`; the header opens no query of its own.

### 11 — Navbar variant

**Create file: `apps/web/src/components/workspace/workspace-navbar.tsx`** (`"use client"`)

A horizontal bar, `hidden sm:flex`, one `DropdownMenu` per `NAV_GROUPS` entry — **not** the current wrapped-rows layout:

- Trigger: the group's translated name + `ChevronDownIcon`, `aria-hidden` on the icon (per `icons.ts`'s decorative-icon rule, ~lines 27–34). `ChevronDownIcon` is direction-neutral and needs no `rtl:` flip — `icons.ts` ~lines 36–41 says so explicitly.
- A trigger whose group contains the active item gets the same active treatment the items use, so the current section is identifiable with every menu closed.
- Content: `DropdownMenuItem asChild` → `Link`, rendering `<NavItemLabel />`, with `aria-current={isActive ? "page" : undefined}` — identical to the existing mobile menu's own item markup (~lines 514–524).
- The `notifications` unread badge renders inside the menu via `NavItemLabel`, and the group trigger additionally shows the count badge when its own group holds an unread item — otherwise an unread notification becomes invisible behind a closed menu.
- Bar classes: `border-b border-rule bg-surface px-6` with `gap-1`. **No `overflow-x` is needed** — six triggers fit at every breakpoint from `sm` up, which is the whole reason the groups became menus.
- Keyboard: Radix `DropdownMenu` handles arrow keys, Escape and type-ahead; triggers stay in tab order. Use `.focus-ring-always` on triggers (Radix moves focus programmatically, so `:focus-visible` does not always match — `tailwind-tokens.css` ~lines 206–214).

### 12 — Sidebar variant

**Create file: `apps/web/src/components/workspace/workspace-sidebar.tsx`** (`"use client"`)

An `<aside>` rail, `hidden sm:flex`, genuinely designed as a vertical surface rather than a rotated navbar:

- `<nav aria-label={t("nav.label")}>` inside, `w-60` expanded / `w-16` collapsed, `shrink-0`, `border-e border-rule bg-surface` — **`border-e`, never `border-r`**, and `ps-`/`pe-` for any asymmetric padding. `docs/architecture/12-risks-tradeoffs-and-scope.md`'s risk #1 forbids new `ml-`/`mr-`/`left-`/`right-` classes, and a sidebar is precisely where that leak happens.
- `sticky top-0 max-h-screen overflow-y-auto` — the rail scrolls independently of the page, which a 20-item vertical list needs and the navbar never did.
- One section per group: the group name as a real `<p className="px-3 py-1.5 text-xs font-semibold text-ink-subtle">` heading, items stacked beneath as full-width rows. **No `uppercase`, no `tracking-wide`** — `workspace-nav.tsx` ~lines 194–201 explains why (Arabic).
- Item: `flex items-center gap-2 rounded-md border-s-2 px-3 py-2 text-sm`, active → `border-accent bg-accent-surface font-medium text-ink-strong`, inactive → `border-transparent text-ink-muted hover:bg-surface-muted hover:text-ink-strong`, plus `focus-ring`. This is the **same** active treatment as today (reserved border, swapped colour — never a layout shift), applied in a vertical rhythm.
- Collapse toggle: a `Button variant="outline" size="sm"` at the top of the rail with an `aria-label` and `aria-expanded`. Collapsed → labels become `sr-only`, icons centre, and each item gets a `Tooltip` carrying its label (`TooltipProvider`/`Tooltip`/`TooltipTrigger`/`TooltipContent` are already exported from `@crm/ui`). Persist the collapsed flag in `localStorage` under a single key, read inside a `useEffect` (never during render — it would break SSR hydration), defaulting to expanded. **This is a per-user view convenience, not the admin setting** — keep the two clearly separate in the code and in the comments.
- Add one role-named icon export to `packages/ui/src/lib/icons.ts` for the toggle (e.g. `PanelLeftClose as SidebarToggleIcon`). Name it by role, not glyph, per that file's own convention (~lines 10–17). If the chosen glyph is directional, give it `rtl:rotate-180` — the flip `icons.ts` ~lines 36–41 prescribes.
- `<main>` in the sidebar branch keeps `flex-1 p-6` and the `max-w-screen-2xl` inner wrapper, so content never runs under the rail.

### 13 — Retire `workspace-nav.tsx`

After Tasks 9–12, `workspace-nav.tsx` has nothing left to render. **Delete the file and its spec**, re-homing every test case into the new specs (Test Plan §2–5). Update the import in `(agent)/layout.tsx` (line 5). Grep for `workspace-nav` across `apps/web` and `apps/e2e` before deleting, to confirm nothing else references it.

### 14 — The settings UI

**File: `apps/web/src/components/admin/branding-view.tsx`**

In `BrandingForm`, alongside the three existing fields:

- **App name** — an `Input` in the same `<label className="flex flex-col gap-1 text-xs …">` wrapper as its neighbours, with `maxLength={60}`, a placeholder showing the default, and helper text saying the translated default is used when empty. Mirror the `logoUrl` field (lines 107–114) exactly; it needs no validity gate (any text ≤ 60 chars is valid).
- **Navigation layout** — a `<fieldset>` with a `<legend>` (the `<fieldset>` precedent is `apps/web/src/components/automation-rules/automation-rules-view.tsx`) containing two native `<input type="radio">` controls inside styled `<label>` cards, one per option, each with the option name, a one-line description, and a small static CSS-only thumbnail of the arrangement. No `RadioGroup` primitive exists in `@crm/ui` — **do not add one for two options**; a native radio group is already keyboard-accessible (arrow keys, roving tab stop) and needs no JS.
- Extend the draft state (`useState` ~58–60), the `useEffect` re-sync (~66–70) **and its dependency array**, and `handleSubmit`'s payload (~76–80) — for `navigationLayout` send the value directly (a closed union, never an empty string); for `appName` follow the existing `logoUrl` `.trim() ? … : {}` pattern.
- The existing **validation / loading / success / error** states cover the new fields for free: the `Skeleton` triad (~29–34), the `isError` `Alert` + retry (~36–43), `showSuccessToast(t("saveSuccess"))` (~84), and `useErrorMessage(…, { forbidden, generic })` (~85–89). Do not add a parallel mechanism.
- The preview panel (~147–177) gains the resolved brand name above the logo.

**Where the screen lives:** the **existing** Branding tab of `SettingsView` (lines 47, 51–53), reached at `/{locale}/settings`, and the still-live `/{locale}/branding` route. No new route, no new tab, no new nav entry.

### 15 — i18n

**Files: `apps/web/messages/en.json`, `apps/web/messages/ar.json`** — every key in both, no exceptions.

Under the existing `branding` namespace: `appNameLabel`, `appNamePlaceholder`, `appNameHelp`, `navigationLayoutLegend`, `navigationLayoutHelp`, `navigationLayout.sidebar`, `navigationLayout.sidebarDescription`, `navigationLayout.navbar`, `navigationLayout.navbarDescription`, `previewBrandName`.

Under `workspace.nav`: `collapseSidebar`, `expandSidebar`, `groupMenuLabel` (the accessible name for a navbar group trigger, e.g. `"{group} menu"`).

`workspace.appName` stays — it is the fallback. Arabic strings must be real translations; the RTL layout is exercised in Verification §6.

---

## Edge Cases & Failure Modes

- **No `BrandingConfig` row for the branch (every branch today).** `getBrandingForBranch` returns `DEFAULT_BRANDING`; `resolveNavigationLayout(null)` → `NAVBAR`; `appName` falls back to `t("appName")`. Enforced in `nav-items.tsx` (Task 7) and `workspace-header.tsx` (Task 10). Every existing branch renders the navbar, unchanged.
- **`fetchBranding()` fails server-side** (API down, expired token, network error). Returns `null`, exactly as `fetchCurrentUser()` does — `initialBranding` is `null`, the client query retries on its own, and the shell renders `NAVBAR`. Enforced by the `try`/`catch` in `branding-server.ts` (Task 8). A branding outage must never blank the workspace.
- **The layout is changed while another tab is open.** No realtime push exists for branding (Story 82 made the same call deliberately). The other tab keeps its current layout until its next natural refetch or navigation. Acceptable and consistent with every other `useQuery`-backed value here — say so in a comment rather than adding a socket.
- **The admin changes the layout on their own screen.** `useUpdateBrandingMutation` invalidates `brandingQueryKey` (`use-branding.ts` ~179–187), the shell's query re-renders, and the shell swaps presentation **without a route change**. Verify no React key/hydration warning appears during that swap — mounting a whole different nav tree mid-session is the single most likely source of a console error in this story.
- **`appName` set to whitespace only.** `?.trim() || t("appName")` falls back to the default (Task 10). A `??` would print blank — do not use it.
- **`appName` in Arabic, with an emoji, or at exactly 60 characters.** Stored and rendered as-is; `MaxLength(60)` is a character count, and the sidebar/navbar brand block needs `truncate` so a long name cannot force horizontal overflow.
- **A long localized group name in Arabic** (e.g. `"النظام والتكاملات"`). The sidebar rail is `w-60` fixed — headings must wrap or truncate, never widen the rail. The navbar trigger must not grow the bar past six comfortable triggers.
- **Sidebar under RTL.** `border-e`/`ps-`/`pe-`/`border-s-2` mirror automatically from `dir="rtl"` on `<html>` (set in `[locale]/layout.tsx`, untouched). **Any `border-r`/`pl-`/`left-` here is a defect.** Grep the two new variant files for `\b(ml|mr|pl|pr|left|right|border-[lr])-` before committing.
- **Below `sm`, in both variants.** The desktop nav (`hidden sm:flex`) and the sidebar rail are both hidden; the hamburger `DropdownMenu` (`sm:hidden`, Task 10) is the only navigation. The sidebar rail can therefore never occupy a phone's width, and there is no horizontal overflow in either mode.
- **20 items in a 720px-tall viewport, sidebar mode.** The rail's own `overflow-y-auto` scrolls it; the page's scroll is unaffected. This is the case the navbar never had, and the reason the rail is not simply `h-full`.
- **Keyboard traversal of the collapsed sidebar.** Labels are `sr-only`, not removed, so the accessible name survives collapse; the `Tooltip` is a sighted-user affordance on top of that, never the only label.
- **Skip link.** It stays the first focusable element (`(agent)/layout.tsx` lines 41–43, outside the shell) and still targets `#main-content`, which moves into `WorkspaceShell` but keeps its `id`. Verify in **both** variants — the sidebar puts a whole rail between the link and `<main>` in DOM order.
- **Route-loading / navigation overlay.** `NavigationOverlayListener` (`apps/web/src/components/providers/navigation-overlay-listener.tsx`) and each route's own `loading.tsx` are untouched, and both variants use the same `useNavigatingRouter`-driven `Link`s. Neither variant may introduce a second loading mechanism — `workspace-nav.tsx` ~line 211 already rules that out.
- **`PATCH /branding` with an invalid `navigationLayout`** (e.g. lowercase `"sidebar"`, or `"TOPBAR"`). `@IsEnum` rejects it with a 400 before it reaches the service; the frontend can only ever send one of the two radio values.
- **The portal receives the two new fields.** `apps/portal/src/lib/branding-api.ts`'s own interface does not declare them, so they are ignored. Neither is a secret and neither changes any portal rendering. No portal file changes in this story.

---

## Test Plan

1. **`apps/web/src/components/workspace/nav-items.spec.tsx`** *(new, unit)* — `isNavItemActive` returns `true` for an exact match and for a nested route (`/en/tickets/ticket-1` → `/en/tickets`), and `false` for a sibling prefix (`/en/tickets-archive` must **not** match `/en/tickets`) and for `null`; `resolveNavigationLayout` maps `"SIDEBAR"` → `"SIDEBAR"` and `"NAVBAR"`/`null`/`undefined` → `"NAVBAR"`; `NAV_GROUPS` still has six groups and every item has a unique `href` (the regression guard against a duplicated route definition).
2. **`apps/web/src/components/workspace/workspace-header.spec.tsx`** *(new, component)* — **re-home every existing case from `workspace-nav.spec.tsx` that concerns the header**: sign-out (`logout` → `clearAccessToken` → `clearQueryCache` → `push`), branch switching including both rejection paths, locale switching including the best-effort `updatePreferredLocale` failure, the `realtimeReconnecting` banner, the logo-vs-text brand conditional, and the `--brand-primary` inline style. **New:** renders `appName` when set; falls back to `t("appName")` when `null` **and** when whitespace-only. Reuse the mock block at `workspace-nav.spec.tsx` ~lines 14–76 verbatim.
3. **`apps/web/src/components/workspace/workspace-navbar.spec.tsx`** *(new, component)* — six group triggers render; opening one reveals that group's links with the right `href`s; the active item carries `aria-current="page"` under both `/en/tickets` and the nested `/en/tickets/ticket-1`; the group containing the active item is marked active with its menu closed; the unread badge appears on the `notifications` item and on its group trigger; **all 20 items are present across the six menus** (the permission-visibility regression guard); renders correctly with `locale = "ar"`.
4. **`apps/web/src/components/workspace/workspace-sidebar.spec.tsx`** *(new, component)* — all six group headings and all 20 links render; `aria-current="page"` on the active item, exact and nested; the collapse toggle flips `aria-expanded` and keeps every link's accessible name (query by role + name while collapsed); the collapsed state round-trips through `localStorage`; renders correctly with `locale = "ar"`.
5. **`apps/web/src/components/workspace/workspace-shell.spec.tsx`** *(new, component)* — renders the navbar when `navigationLayout` is `"NAVBAR"`, `null`, or the query has no data; renders the sidebar when `"SIDEBAR"`; renders `children` and the `#main-content` landmark in **both**; `initialBranding` is honoured on the first render with no intermediate navbar frame. Stub `WorkspaceNavbar`/`WorkspaceSidebar` the way `settings-view.spec.tsx` (~lines 15–23) stubs its three panels.
6. **`apps/web/src/components/admin/branding-view.spec.tsx`** *(update)* — the app-name input renders the current value and submits it; the layout radio group renders both options with the current one checked; selecting the other and saving sends `navigationLayout: "SIDEBAR"`; the preview shows the resolved brand name; the existing loading / error / success / forbidden cases still pass **unweakened**.
7. **`apps/web/src/components/settings/settings-view.spec.tsx`** *(must stay unchanged)* — it stubs `BrandingView` entirely, so it must keep passing untouched. If it does not, the tab composition was changed, which this story must not do.
8. **`apps/api/src/modules/admin/branding.service.spec.ts`** *(update, unit)* — `getBrandingForBranch` returns both new fields from an existing row, and `null` for both when no row exists; `updateBranding`'s create path writes both; its update path leaves an omitted field untouched (explicitly: patching only `navigationLayout` must not clear `appName`).
9. **`apps/api/test/branding.e2e-spec.ts`** *(update, integration)* — both new fields default to `null` before any `PATCH`; a `PATCH` with `{ appName, navigationLayout: "SIDEBAR" }` persists and is reflected on the next `GET`; a partial `PATCH` of one new field leaves the other four untouched; `{ navigationLayout: "TOPBAR" }` is rejected 400; a 61-character `appName` is rejected 400. The existing 401/403 cases stay unchanged.
10. **`apps/api/test/portal-branding.e2e-spec.ts`** *(update, integration)* — one assertion: after the agent sets `appName`/`navigationLayout`, `GET /portal/branding` still returns 200 and its existing three fields are unchanged. Guards against the portal surface breaking on the widened type.
11. **`apps/e2e/tests/admin-navigation-layout.spec.ts`** *(new, Playwright)* — the intake's named e2e coverage, as one flow mirroring `agent-resolves-ticket.spec.ts`'s shape (`test.use({ baseURL: "http://localhost:3000" })`, `loginAsAdmin()` for fixture setup):
    1. sign in as the seeded admin; assert the navbar's group triggers are present (default layout);
    2. navigate via the navbar into a destination and assert the URL;
    3. go to `/en/settings`, choose **Sidebar**, save, and assert the success toast;
    4. assert the sidebar rail is now present and the navbar triggers are gone;
    5. **reload the page** and assert the sidebar is still rendered (the persistence criterion);
    6. navigate via the sidebar to a second destination and assert the active item carries `aria-current="page"`;
    7. assert the full item list is present (permission visibility unchanged);
    8. **restore `NAVBAR` in an `afterEach` via the API** (`PATCH /branding` with the admin token through `support/api-client.ts`) — the seeded branch is shared with `agent-resolves-ticket.spec.ts`, and leaving it on `SIDEBAR` would change the shell under a suite that never opted into it. Add a `setBrandingAsAdmin(token, input)` helper to `apps/e2e/tests/support/api-client.ts` for this.

**Do not** weaken, skip, or delete any existing assertion while re-homing `workspace-nav.spec.tsx`'s 802 lines. Every case it holds must exist, passing, in one of the new specs — the file count changes, the coverage does not.

---

## Migration / Rollback

- **Forward:** one additive migration (Task 2) — one `CREATE TYPE`, two `ADD COLUMN`, both nullable. No existing column altered, no data backfilled, no table dropped.
- **Half-applied state:** if the type is created but a column is not, Prisma Client generation fails loudly at build time rather than at runtime. There is no window where the API serves a row whose shape it cannot read, because `toSummary` reads named fields and both new ones are nullable.
- **Rollback:** revert the commit and run `prisma migrate resolve --rolled-back` (or, locally, `prisma migrate reset --force` — `CLAUDE.md` §5 permits this against a dev database). The two columns can equally be left in place harmlessly: pre-Story-129 code never selects them. No data is lost either way — nothing that existed before this story is rewritten.
- **Deploy ordering:** the API must migrate before `apps/web` is deployed, the same ordering every prior additive story here has used. A new `apps/web` against an un-migrated API gets `undefined` for both fields, which resolves to `NAVBAR` + the default app name — degraded, not broken.

---

## Verification Steps

1. **Backend builds:** from the repo root — `pnpm --filter @crm/api exec prisma generate`, then `pnpm --filter @crm/api typecheck` and `pnpm --filter @crm/api test`.
2. **Backend integration:** `pnpm --filter @crm/api test:e2e`. If the full suite shows the **pre-existing** `identity.e2e-spec.ts` isolation failures `CLAUDE.md` §5 documents, isolate this story's own specs to tell a real regression from that known defect: from `apps/api`, `npx vitest run test/branding.e2e-spec.ts test/portal-branding.e2e-spec.ts --no-file-parallelism`. Run `pnpm prisma:seed` from `apps/api` first if the permission baseline looks polluted.
3. **Frontend runs:** `pnpm --filter @crm/web typecheck && pnpm --filter @crm/web lint && pnpm --filter @crm/web test`.
4. **Portal regression** (no file in it changes, but its type sits on the widened endpoint): `pnpm --filter @crm/portal typecheck && pnpm --filter @crm/portal test`.
5. **Workspace-wide:** `pnpm typecheck && pnpm lint && pnpm build` — the CI reference sequence in `.github/workflows/ci.yml`.
6. **Manual, both locales × both directions × both layouts** (eight combinations; this story is a visual change and no automated check substitutes for looking at it): run `apps/api` and `apps/web`, then for each of `/en/…` and `/ar/…`, with `navigationLayout` set to each value, confirm — the active route is unmistakable; no horizontal scrollbar at 1440px, 1024px, 768px and 390px widths; the sidebar rail sits on the correct side under RTL and its collapse toggle points the correct way; Tab reaches the skip link first, then the nav, in order; the browser console is free of React warnings, **including immediately after saving a layout change** (the mid-session shell swap, per Edge Cases).
7. **E2E:** `pnpm --filter @crm/e2e test` (its `webServer` needs `@crm/api`, `@crm/web` and `@crm/portal` built first — `pnpm exec turbo run build --filter=@crm/web`, etc., per `apps/e2e/playwright.config.ts`'s own doc comment).
8. **Diff hygiene:** `git diff --check` and `git status --short` — no `.env*`, no `.squad/secrets.yaml`, no unrelated file.

---

## Done Criteria

- [ ] `BrandingConfig.appName` and `BrandingConfig.navigationLayout` exist, both **nullable**, in one additive migration containing no `DROP`.
- [ ] `NavigationLayout` enum (`SIDEBAR`/`NAVBAR`) declared with `@@schema("admin")`.
- [ ] `GET`/`PATCH /branding` carry both new fields; `@IsEnum` rejects an unknown layout (400) and `@MaxLength(60)` rejects an over-long name (400); **no new permission** was added, and `branding:read`/`branding:update` still gate the surface.
- [ ] `GET /portal/branding` still returns 200 with its existing three fields intact; **no file under `apps/portal` changed.**
- [ ] `NAV_GROUPS`, `NavLinkItem`, `NavGroup`, `NavItemLabel`, `isNavItemActive` and `resolveNavigationLayout` live in exactly one module; grep confirms **no route, label key, icon, or active-route rule is declared in more than one place.**
- [ ] An admin can switch Sidebar ⇄ Navbar from the existing Settings → Branding tab; the choice persists across refresh and a new session; no rebuild or redeploy is involved.
- [ ] The layout applies on **every** `(agent)` route and is resolved server-side — no visible flash of the other layout on first paint.
- [ ] An unconfigured branch renders the navbar and the translated default app name, exactly as before this story.
- [ ] Both variants: the full 20-item list (permission visibility unchanged from today), `aria-current="page"` on the active item for exact **and** nested routes, keyboard-reachable, correct under `dir="rtl"`, no horizontal overflow at 390px/768px/1024px/1440px, and the existing hamburger menu below `sm`.
- [ ] **Zero** `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-`/`border-l-`/`border-r-` classes in any file this story adds or edits (grep-verified).
- [ ] **Zero** raw `slate-*` classes in any file this story adds; new surfaces use the S-1 semantic tokens.
- [ ] The navigation overlay, the per-route `loading.tsx` skeletons and the skip link all still work in both variants; no second loading mechanism was introduced.
- [ ] No React warning or console error during a route transition or during a mid-session layout swap.
- [ ] Every test in `## Test Plan` exists and passes; every case from the deleted `workspace-nav.spec.tsx` survives in a new spec, **unweakened**; every pre-existing suite is still green.
- [ ] Every command in `## Verification Steps` passes (or a genuine environmental blocker is documented per `CLAUDE.md` §5 — never fabricated).
- [ ] Both locales carry real translations for every new key; `en.json` and `ar.json` have identical key sets.
- [ ] `git diff --check` passes; no unrelated source, schema, or configuration change is in the diff.
