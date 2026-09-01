# Story 82 — Branding — Live Logo/Color Consumption

## Prerequisites

- Story 62 (`admin-branch-branding`): `BrandingConfig` model,
  `BrandingService`/`BrandingController` (`GET`/`PATCH /branding`,
  agent-only, `branding:read`/`branding:update`), the admin config form
  (`apps/web/src/components/admin/branding-view.tsx`).
- Story 44 (`agent-workspace-navigation-menu`): `WorkspaceNav`, the
  agent workspace's persistent header.
- Story 52 (`customer-portal-authentication-foundation`): `PortalHeader`,
  the portal's persistent header; `@PortalRoute()`/`AudienceGuard`.
- Story 24 (`in-app-notification-delivery`): `BranchNotifications`, the
  direct structural precedent for "one branch-wide consumer, wired into
  the authenticated layout, not per-page."

All prerequisites are complete; the story is fully unblocked.

---

## Story Goal

Story 62 shipped `BrandingConfig` and an admin-only preview form, but
explicitly deferred live consumption. `docs/architecture/08-supporting-
domains.md` still states, unfulfilled: *"Branding configuration (logo,
colors, and per-branch identity)... is consumed by both Next.js apps
through Tailwind CSS variables."* This story delivers that:

1. A new `GET /portal/branding` endpoint (the Portal's own read surface —
   `GET /branding` is agent-only and meaningless for a Contact).
2. `WorkspaceNav` (`apps/web`) and `PortalHeader` (`apps/portal`) each
   fetch their own branch's branding once, at the persistent-header
   level, and:
   - render the branch's logo in place of the plain text app-name link
     when one is configured (falls back to the existing text otherwise);
   - apply the branch's `primaryColor` to the header's own bottom border
     via a CSS custom property + a Tailwind arbitrary-value class with a
     literal fallback (`border-[var(--brand-primary,theme(colors.slate.
     200))]`) — the color visibly changes only once a branch configures
     one; every unconfigured branch renders pixel-identical to today.

**Not in scope:** any change to `[locale]/layout.tsx` (the `dir`/`lang`
RTL root, untouched), any new `ml-`/`mr-`/`left-`/`right-` class anywhere,
recoloring every button/accent across either app (only the persistent
header's own border + logo — a deliberately small, visible, testable
slice, not a full theming system), a live preview matching exactly what
`BrandingView`'s own preview already shows (that preview is a separate,
already-shipped surface, unchanged), and any change to
`BrandingService`'s agent-facing `GET`/`PATCH /branding` behavior.

---

## Design decision — why this passes the RTL/i18n risk five prior cycles flagged

`docs/architecture/12-risks-tradeoffs-and-scope.md` risk #1 warns against
new `ml-`/`mr-`/`left-`/`right-` classes and, by extension, touches to
shared layout. Re-reading the actual files settles the scope precisely:

- `apps/web/src/app/[locale]/layout.tsx` and
  `apps/portal/src/app/[locale]/layout.tsx` are the *only* two files in
  either app that read `locale` to set `dir`/`lang` on `<html>`. Neither
  is touched by this story.
- The natural, and only, per-branch consumption point is one level
  *inside* that boundary: `(agent)/layout.tsx`/`(customer)/layout.tsx`
  and their own `WorkspaceNav`/`PortalHeader` children — server/client
  components that already resolve `user.branchId`/`contact.branchId`
  post-auth and already compose one branch-wide child each
  (`BranchNotifications`, and `PortalHeader` itself). This story adds a
  data fetch and a conditional render inside two already-mutable,
  already-tested client components — not a change to either app's shared
  routing/RTL root.
- Every new class this story adds is a logical (flex/border/height)
  utility already used elsewhere in both headers today
  (`border-b`, `h-8`, `w-auto` — see `BrandingView`'s own existing logo
  `<img>` for the exact precedent) — no new physical-direction class.

---

## Context — Read These Files First

1. `apps/api/src/modules/admin/branding.service.ts` (whole file) —
   `getBranding()`'s `TenantContext.requireBranchScope()` +
   findUnique-or-default shape is refactored into a new,
   branch-id-parameterized `getBrandingForBranch(branchId)` that both the
   existing agent-facing method and this story's new portal method call.
2. `apps/api/src/modules/admin/branding.controller.ts`,
   `admin.module.ts` — unchanged; confirms `BrandingService` isn't
   currently exported (it will need to be, for `PortalModule` to inject
   it).
3. `apps/api/src/modules/portal/portal-knowledge-base.controller.ts` —
   the exact `@PortalRoute()` + `claims.branchId` (no `TenantContext`,
   no extra Contact lookup) pattern this story's new
   `PortalBrandingController` mirrors line-for-line.
4. `apps/api/src/modules/portal/portal.module.ts` — gains an `AdminModule`
   import (no circularity: `AdminModule` imports nothing from `portal`).
5. `apps/web/src/hooks/use-branding.ts`, `apps/web/src/lib/branding-api.ts`
   — the existing agent-facing `useBrandingQuery`/`getBranding` this
   story reuses unchanged inside `WorkspaceNav`.
6. `apps/web/src/components/workspace/workspace-nav.tsx` (whole file) —
   the header JSX being extended (app-name link, header `<header>` tag).
7. `apps/web/src/components/notifications/branch-notifications.tsx` —
   read as the "one branch-wide consumer composed into `(agent)/layout.tsx`
   without becoming that layout's own concern" precedent (structural
   reference only; this story's own consumer lives inside `WorkspaceNav`
   itself, not as a sibling component, since it renders inline in the
   header rather than being a fire-and-forget socket listener).
8. `apps/portal/src/components/portal/portal-header.tsx` (whole file) —
   the header JSX being extended, portal side.
9. `apps/web/src/components/admin/branding-view.tsx` lines ~126–138 — the
   exact existing `<img>`/`eslint-disable @next/next/no-img-element`
   precedent this story's two new logo renders copy verbatim.

---

## Backend Tasks

### 1 — `BrandingService.getBrandingForBranch`

**File: `apps/api/src/modules/admin/branding.service.ts`**

```ts
async getBranding(): Promise<BrandingSummary> {
  const { branchId } = this.tenantContext.requireBranchScope();
  return this.getBrandingForBranch(branchId);
}

/** Story 82 — the branch-id-parameterized half `PortalBrandingController`
 * calls directly (Contacts have no `TenantContext`; portal requests
 * derive scope from their own JWT's `branchId` claim instead — see
 * `PortalKnowledgeBaseController`'s own precedent). */
async getBrandingForBranch(branchId: string): Promise<BrandingSummary> {
  const config = await this.prisma.brandingConfig.findUnique({ where: { branchId } });
  return config ? toSummary(config) : DEFAULT_BRANDING;
}
```

`updateBranding` is unchanged — the Portal surface is read-only.

### 2 — Export `BrandingService`

**File: `apps/api/src/modules/admin/admin.module.ts`** — add
`exports: [BrandingService]`.

### 3 — `PortalBrandingController`

**New file: `apps/api/src/modules/portal/portal-branding.controller.ts`**:

```ts
@ApiTags("portal")
@ApiBearerAuth()
@Controller("portal/branding")
export class PortalBrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @PortalRoute()
  @Get()
  getBranding(@Req() request: Request): Promise<BrandingSummary> {
    const claims = request.user as JwtAccessTokenClaims;
    return this.brandingService.getBrandingForBranch(this.requireBranchId(claims));
  }

  private requireBranchId(claims: JwtAccessTokenClaims): string {
    if (!claims.branchId) {
      throw new UnauthorizedException("Token has no associated branch");
    }
    return claims.branchId;
  }
}
```

(Identical `requireBranchId` guard to `PortalKnowledgeBaseController`'s
own — a portal-issued token always carries `branchId`, this only guards
the invariant.)

**File: `apps/api/src/modules/portal/portal.module.ts`** — import
`AdminModule`, register `PortalBrandingController`.

---

## Frontend Tasks

### 4 — `apps/web`: `WorkspaceNav` consumes branding

**File: `apps/web/src/components/workspace/workspace-nav.tsx`**

- Import `useBrandingQuery` from `@/hooks/use-branding` (already exists,
  unchanged).
- Call `const brandingQuery = useBrandingQuery();` inside `WorkspaceNav`.
- Header tag gains the CSS custom property + arbitrary-value border
  class:

```tsx
<header
  style={{ "--brand-primary": brandingQuery.data?.primaryColor } as React.CSSProperties}
  className="flex items-center justify-between border-b-2 border-[var(--brand-primary,theme(colors.slate.200))] bg-white px-6 py-3"
>
```

- The app-name link becomes conditional:

```tsx
{brandingQuery.data?.logoUrl ? (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={brandingQuery.data.logoUrl}
    alt={t("appName")}
    className="h-8 w-auto"
  />
) : (
  <a href={`/${locale}/tickets`} className="text-sm font-semibold text-slate-900">
    {t("appName")}
  </a>
)}
```

(The logo is not itself a link to `/tickets` — mirrors `BrandingView`'s
own preview `<img>`, a plain visual element, not a nav control; the
existing `WorkspaceNav`'s persistent nav row already provides
navigation.)

### 5 — `apps/portal`: new API client, hook, `PortalHeader` consumption

**New file: `apps/portal/src/lib/branding-api.ts`** — mirrors
`apps/web/src/lib/branding-api.ts`'s `BrandingSummary` type and
`getBranding` shape exactly, calling `GET /portal/branding`:

```ts
import { apiFetch } from "./api";

export interface BrandingSummary {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

export function getBranding(): Promise<BrandingSummary> {
  return apiFetch<BrandingSummary>("/portal/branding");
}
```

**New file: `apps/portal/src/hooks/use-branding.ts`**:

```ts
import { useQuery } from "@tanstack/react-query";
import { getBranding } from "@/lib/branding-api";

export const brandingQueryKey = ["branding"] as const;

export function useBrandingQuery() {
  return useQuery({ queryKey: brandingQueryKey, queryFn: getBranding });
}
```

**File: `apps/portal/src/components/portal/portal-header.tsx`** — same
two changes as `WorkspaceNav` (Task 4): `useBrandingQuery()` call, header
gains the `--brand-primary` style + arbitrary-value border class, and the
`signedInAs` app-name link becomes conditional on `logoUrl` the same way.

---

## Edge Cases & Failure Modes

- **No `BrandingConfig` row for the branch (every branch today)**:
  `getBrandingForBranch` returns `DEFAULT_BRANDING` (all `null`) — the
  CSS variable is set to `undefined` (React omits it entirely), so the
  arbitrary-value class's own literal fallback (`theme(colors.slate.
  200)`) applies, and the logo conditional falls to the existing text
  link. Every current branch renders **pixel-identical** to before this
  story.
- **`brandingQuery` still loading on first paint**: `data` is `undefined`
  during that window, which resolves identically to "no config" above —
  no loading-state flash of a different color, no skeleton needed (this
  is a header accent, not primary content).
- **`brandingQuery` errors (e.g. the branding request itself fails)**:
  same fallback path (`data` stays `undefined`) — the header/nav still
  renders and functions normally; a failed branding fetch never blocks
  or breaks navigation, sign-out, or any other `WorkspaceNav`/
  `PortalHeader` responsibility.
- **A malformed/unreachable `logoUrl`**: the `<img>` tag's own browser-
  native broken-image fallback applies (no custom error UI is
  in scope) — the same behavior `BrandingView`'s existing preview `<img>`
  already has for the exact same input.
- **RTL (`ar` locale)**: the header's `flex items-center justify-between`
  layout, the border utility, and the conditional logo/text swap are all
  direction-agnostic (no `ml-`/`mr-`/`left-`/`right-` anywhere) — RTL
  mirrors automatically via `dir="rtl"` on `<html>`, unchanged and
  untouched by this story.
- **A Contact/agent whose branch's `BrandingConfig` is updated while
  already signed in**: no realtime push is introduced (matches
  `BrandingView`'s own scope, and `docs/architecture/08`'s wording,
  which never promises live push) — the new value appears on the next
  natural refetch (a fresh page load / navigation), identical to how
  every other `useQuery`-backed value in this codebase without an
  explicit realtime wiring already behaves.

---

## Test Plan

1. **`apps/api/src/modules/admin/branding.service.spec.ts`** — update to
   cover `getBrandingForBranch` directly (branch-scoped lookup,
   default-when-absent, existing-row passthrough) and confirm
   `getBranding()` still resolves `TenantContext.requireBranchScope()`
   first, then delegates.
2. **New `apps/api/src/modules/portal/portal-branding.controller.spec.ts`**
   (or inline in an e2e spec if this codebase has no controller-unit-spec
   precedent for portal controllers — confirm by checking whether
   `portal-knowledge-base.controller.ts` has one; mirror whichever
   convention exists) — `getBranding` reads `claims.branchId` and calls
   `getBrandingForBranch` with it; throws when `branchId` is missing.
3. **New `apps/api/test/portal-branding.e2e-spec.ts`** — 401
   unauthenticated; 401 for an agent-audience token (via `@PortalRoute()`'s
   existing `AudienceGuard`); returns all-null defaults before any
   `PATCH /branding`; reflects a real `PATCH /branding` (as the admin) on
   the next `GET /portal/branding` (proves the same underlying row is
   read both ways).
4. **`apps/web/src/components/workspace/workspace-nav.spec.tsx`** — new
   cases: renders the existing text app-name link when no branding is
   configured (mirrors every current test's implicit assumption,
   confirmed explicitly now); renders the logo `<img>` instead when
   `logoUrl` is set; the header's inline `--brand-primary` style reflects
   `primaryColor` when set, and is `undefined` when not.
5. **`apps/portal/src/components/portal/portal-header.spec.tsx`** — same
   shape of new cases, mirroring Task 4's assertions.
6. **`apps/portal/src/hooks/use-branding.ts`**: no dedicated spec needed
   (matches this codebase's own established precedent for trivial
   `useQuery` wrappers — exercised via `portal-header.spec.tsx` instead).

---

## Migration / Rollback

- No schema change at all — `BrandingConfig` already exists (Story 62).
  This story is pure API-surface (`getBrandingForBranch`,
  `GET /portal/branding`) and frontend consumption.
- **Rollback:** revert `WorkspaceNav`/`PortalHeader` to their
  pre-Story-82 JSX and remove `PortalBrandingController`. Zero data loss
  — nothing new is written anywhere.

---

## Verification Steps

1. `pnpm --filter @crm/api typecheck`
2. `pnpm --filter @crm/api test`
3. `pnpm --filter @crm/api test:e2e` (or the isolated-file fallback
   Stories 79–81 documented, if the sandbox's Prisma consent gate blocks
   `migrate reset --force` again — this story runs no new migration, so
   the fallback is even lower-risk here).
4. `pnpm --filter @crm/web typecheck && pnpm --filter @crm/web lint && pnpm --filter @crm/web test`
5. `pnpm --filter @crm/portal typecheck && pnpm --filter @crm/portal lint && pnpm --filter @crm/portal test`
6. `pnpm typecheck && pnpm lint && pnpm build && pnpm test` (confirms
   `apps/worker` and every other untouched package remain unaffected).
7. Manual/visual sanity (optional but recommended given this is a visual
   change): run `apps/web`/`apps/portal` locally, confirm both `en`/`ar`
   headers render identically to pre-Story-82 with no `BrandingConfig`
   row, and that a test `PATCH /branding` with a `primaryColor`/`logoUrl`
   visibly changes the header border/logo on next load without breaking
   RTL layout.

---

## Done Criteria

- [ ] `BrandingService.getBrandingForBranch(branchId)` exists and is used
      by both `getBranding()` (agent) and the new portal endpoint.
- [ ] `GET /portal/branding` exists, `@PortalRoute()`-gated, returns the
      caller's own branch's branding (or defaults), read-only.
- [ ] `WorkspaceNav` and `PortalHeader` both render a configured logo in
      place of the plain app-name text, and apply `primaryColor` to the
      header's border via a CSS variable + Tailwind arbitrary value with
      a literal fallback.
- [ ] Every currently-unconfigured branch (i.e., every branch that
      exists today) renders pixel-identical headers to before this
      story.
- [ ] No `ml-`/`mr-`/`left-`/`right-` class introduced anywhere; no
      change to either app's `[locale]/layout.tsx`.
- [ ] `BrandingView`'s own existing admin form/preview is unchanged.
- [ ] Every item in `## Test Plan` is added/updated and passing.
- [ ] Every command in `## Verification Steps` passes.
- [ ] Every pre-existing test suite remains green, unweakened.
