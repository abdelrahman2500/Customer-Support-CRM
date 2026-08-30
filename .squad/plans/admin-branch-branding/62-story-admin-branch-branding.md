# Story 62 — Administration — Branch Branding (Foundation)

## Prerequisites

- `audit-log-read-endpoint` Story 37: `AuditLogsController`/`AdminModule` — the `admin`-schema-owning module this story's new controller/service join, mirroring its exact branch-scoped shape.

---

## Story Goal

Let a branch admin configure a logo URL and two brand colors (primary/secondary) for their branch, viewable as a live preview on the same admin screen. Closes the "branding" piece of Administration's documented scope (`docs/architecture/03-domain-boundaries.md`: "System configuration, branding, append-only audit logs" — audit logs shipped in Story 37).

**Not in scope**: live consumption in either frontend app's shared layout/header (no CSS-variable injection, no logo rendered anywhere outside this story's own admin form) — the config is stored and previewable, not yet applied application-wide (see plan overview's dependency note for why); "system configuration" (a separate, still-undefined piece of Administration's scope, not attempted here); logo file upload (a URL field only — object-storage upload is a separate concern, `docs/architecture/09-integrations.md`'s S3/MinIO scope, not this story's); per-department (only per-branch) branding.

---

## Context — Read These Files First

1. `apps/api/src/modules/admin/audit-logs.service.ts` — the exact branch-scoped, single-model-in-the-`admin`-schema shape this story's `BrandingService` mirrors.
2. `apps/api/src/modules/notifications/notification-preferences.service.ts` (Story 58) / `notification-templates.service.ts` (Story 61) — the exact "one row per branch, `PATCH` is upsert, `GET` returns a default (never 404) when none exists yet" shape this story's `BrandingConfig` follows, chosen over `BusinessHoursCalendar`'s stricter create-then-update-with-404 precedent because branding has no nested sub-collections needing careful initialization.
3. `apps/web/src/components/automation-rules/automation-rules-view.tsx` — the exact single-page, inline-form shape this story's new Branding admin screen mirrors.

---

## Design decisions

1. **New `BrandingConfig` model** (`admin` schema): `id`, `branchId` (`@unique`), `logoUrl?`, `primaryColor?`, `secondaryColor?`, `createdAt`, `updatedAt` — one row per branch, all fields optional (an unconfigured branch has no row at all, not a row of nulls).
2. **`PATCH /branding` is upsert, `GET /branding` never 404s** — returns `{ logoUrl: null, primaryColor: null, secondaryColor: null }` when no row exists yet, mirroring `NotificationPreference`'s "absence means default" convention rather than `BusinessHoursCalendar`'s stricter create/update split (simpler; branding has no sub-resources that would make an implicit first-touch create ambiguous).
3. **New permissions `branding:read`/`branding:update`** — mirrors `sla:read`/`sla:update`'s naming exactly; no `branding:create` (upsert covers it). Granted to `SuperAdmin` only via the existing wildcard.
4. **Colors validated as `#rrggbb` hex strings** (`@Matches(/^#[0-9A-Fa-f]{6}$/)`), `logoUrl` validated as a URL (`@IsUrl()`) — both optional.
5. **In-form preview only** — the admin screen renders a small swatch/logo preview using the form's own current values (not fetched/rendered anywhere else) — real enough to be useful, zero risk to any shared, already-tested rendering surface.

---

## Implementation Tasks

### Backend

1. **`apps/api/prisma/schema.prisma`** — add `BrandingConfig` (`admin` schema) + back-relation on `Branch`.
2. **Migration** — generated via `prisma migrate dev`.
3. **`apps/api/prisma/seed.ts`** — add `"branding:read"`, `"branding:update"` to `PERMISSION_CATALOG`.
4. **New `apps/api/src/modules/admin/dto/update-branding.dto.ts`** — `logoUrl?` (`@IsOptional() @IsUrl()`), `primaryColor?`/`secondaryColor?` (`@IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/)`).
5. **New `apps/api/src/modules/admin/branding.service.ts`** — `BrandingSummary` interface; `getBranding()` (branch-scoped, defaults to nulls), `updateBranding(dto)` (upsert on `branchId`).
6. **New `apps/api/src/modules/admin/branding.controller.ts`** — `GET /branding` (`branding:read`), `PATCH /branding` (`branding:update`).
7. **`apps/api/src/modules/admin/admin.module.ts`** — add the new controller/service.
8. **Tests** — see Test Plan.

### Frontend

9. **New `apps/web/src/lib/branding-api.ts`** — own file: `BrandingSummary` type + `getBranding`/`updateBranding`.
10. **New `apps/web/src/hooks/use-branding.ts`** — `useBrandingQuery`, `useUpdateBrandingMutation`.
11. **New `apps/web/src/components/admin/branding-view.tsx`** — a form (logo URL, two color pickers/hex inputs) + a small preview block using the form's own live values.
12. **New `apps/web/src/app/[locale]/(agent)/branding/page.tsx`** — one-line pass-through.
13. **`apps/web/src/components/workspace/workspace-nav.tsx`** — append `{ href: "branding", labelKey: "nav.branding" }`.
14. **i18n** — `apps/web/messages/{en,ar}.json`: `workspace.nav.branding` + a new top-level `branding` namespace.
15. **Tests** — see Test Plan.

---

## API contract

- `GET /branding` — `branding:read` — `{ logoUrl, primaryColor, secondaryColor }`, branch-scoped, all-null defaults when unconfigured.
- `PATCH /branding` — `branding:update` — any subset of the three fields, upserted.

## Tests

**Backend unit** (new `branding.service.spec.ts`): default-nulls-when-no-row, upsert create-vs-update path, branch scoping.

**Backend e2e** (new `branding.e2e-spec.ts`): 401/403; defaults to nulls for a branch with no config; a real `PATCH` persists and is reflected on the next `GET`; partial updates leave other fields untouched.

**Frontend component**: `branding-view.spec.tsx` (loading/error/populated/save states, preview reflects live form input).

## Regression requirements

Every existing test suite remains green, unweakened.

## Migration requirements

One migration: new `branding_configs` table. No existing table altered.

## Security risks/mitigations

- **Branch isolation**: identical `TenantContext.requireBranchScope()` mechanism as every other branch-scoped resource.
- **New permission surface**: `branding:read`/`branding:update` gate both routes; no existing permission's meaning changes.
- **`logoUrl` is stored, never fetched/rendered by the backend** — no SSRF surface; the frontend only ever renders it as an `<img src>` (browser-side load, same trust model as any other user-supplied URL already accepted elsewhere in this codebase, e.g. none currently exist, so this is the first — noted, not a regression).

## Verification commands

```
pnpm --filter @crm/api test
pnpm --filter @crm/api test:e2e
pnpm --filter @crm/web test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

## Done criteria

- [ ] `BrandingConfig` exists, migration applied.
- [ ] `GET`/`PATCH /branding` exist, permission-correct, branch-scoped, null-defaults when unconfigured.
- [ ] New Agent Workspace "Branding" screen renders the form + live preview, saves correctly.
- [ ] Both locales translated for every new string.
- [ ] All listed tests exist and pass; every pre-existing test remains green, unweakened.
- [ ] Typecheck/lint/build clean, workspace-wide; `git status --short` clean before commit.

---

## Non-Goals (explicit)

- Live CSS-variable/logo consumption in either app's shared layout; "system configuration"; logo file upload; per-department branding.
- Any README change.
