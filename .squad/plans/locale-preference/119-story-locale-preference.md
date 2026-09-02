# Story 119 — i18n/RTL: Persisted locale preference + language switcher

## Goal

Let an agent and a portal customer each persist a locale preference and
switch language from within the UI — closing the gap between
`docs/architecture/10-i18n-and-rtl.md`'s documented "stored locale
preference with a session override" and the actual implementation,
where locale is 100% driven by hand-editing the `[locale]` URL segment,
with no in-UI switcher anywhere in either app.

## Non-goals

- No automatic login-time redirect to a stored preferred locale — the
  in-session switcher already gives a one-click path; an auto-redirect
  heuristic is a smaller, separate enhancement deferred until real
  usage discloses a need for it.
- No change to `next-intl`'s own middleware/cookie mechanics
  (`apps/web/src/middleware.ts`/`apps/portal/src/middleware.ts` stay
  unchanged) — persistence is purely an additional, application-level
  preference, not a replacement for the existing URL-segment-driven
  routing.
- No locale field on any other entity — `KnowledgeBaseArticleTranslation`'s
  `KbLocale` (Story 109) is a separate, already-solved, content
  -translation concern, not a user preference.
- No cross-device sync mechanism beyond what the stored DB value
  already gives on the next `GET /auth/me`/`GET /portal/auth/me` call.
- No shared UI package between `apps/web`/`apps/portal` — the switcher
  is implemented once per app, mirroring every other cross-cutting
  header concern in this codebase (branding, notifications, sign-out).

## Design

### Schema (`apps/api/prisma/schema.prisma`)

```prisma
// User (identity schema)
preferredLocale String? @map("preferred_locale")

// Contact (customers schema)
preferredLocale String? @map("preferred_locale")
```

Plain nullable string, no enum (Prisma enums cannot cross schemas, and
`KbLocale` is a distinct, KB-content-specific concern). `null` (every
existing account) means "no explicit choice yet" — mirrors
`User.activeBranchId`'s own Story 118 precedent. Validated against
`apps/web/src/i18n/routing.ts`'s configured locales (`"en"`, `"ar"`) at
the DTO layer (`@IsIn(["en", "ar"])`) — never persisted or trusted as a
third value.

### Backend (`apps/api`)

- `packages/shared/src/auth.ts`: `AuthenticatedUser`/`AuthenticatedContact`
  each gain `preferredLocale: string | null`.
- `IdentityService.getAuthenticatedUser`/`PortalService.getAuthenticatedContact`:
  include `preferredLocale` in their return (no other change to either
  method).
- New `IdentityService.updatePreferredLocale(userId, locale)`: a plain
  `prisma.user.update`, no audit-log entry (a personal presentation
  preference, the same trust tier as `NotificationPreference`'s toggle
  — not the same class of sensitive action `user.reassigned`/
  `auth.branch_switched` are).
- New `PortalService.updatePreferredLocale(contactId, locale)`: mirrors
  the above against `prisma.contact`.
- New `UpdateLocaleDto { locale: "en" | "ar" }` (`@IsIn`), one shared
  copy — both `IdentityController`/`PortalController` import it (a
  DTO, not domain logic, so sharing it across the two controllers in
  the same `apps/api` process doesn't cross any module boundary the
  way sharing code between `apps/api` and `apps/worker` would).
- New routes: `PATCH auth/locale` (`IdentityController`, ordinary
  `AuthGuard`, no extra permission — a personal preference, mirrors
  `GET auth/me`'s own no-extra-permission precedent) and `PATCH
  portal/auth/locale` (`PortalController`, `@PortalRoute()`, mirroring
  `GET portal/auth/me`'s exact guard). Neither reissues a token —
  unlike Story 118's `switchBranch`, locale is not a JWT claim.

### Frontend (`apps/web` + `apps/portal`, each independently)

- `lib/api.ts` gains `updatePreferredLocale(locale)` — an ordinary
  `apiFetch` `PATCH` call (Bearer-authenticated, unlike Story 118's
  cookie-only `switchBranch`).
- `WorkspaceNav`/`PortalHeader` each gain an inline language `<select>`
  next to the existing sign-out control. On change: best-effort
  `updatePreferredLocale()` (a failed persist never blocks the actual
  language switch — mirrors `handleSignOut`'s own `logout()` try/catch
  pattern for a non-critical side effect), then `router.push()` to the
  same pathname with the locale segment swapped (a small
  `buildLocalePath` helper, one per app) — no `next-intl/navigation`
  helper is introduced; neither app uses one anywhere today.

## Acceptance criteria

- [ ] `User.preferredLocale`/`Contact.preferredLocale` added (nullable,
      no FK/enum); `GET auth/me`/`GET portal/auth/me` include it.
- [ ] `PATCH auth/locale`/`PATCH portal/auth/locale` persist a valid
      (`"en"`/`"ar"`) locale; an invalid value 400s; no token reissue.
- [ ] `apps/web`'s `WorkspaceNav` and `apps/portal`'s `PortalHeader`
      each render a language switcher that persists the choice and
      navigates to the same page in the new locale.
- [ ] A failed persist (network error) never blocks the actual
      language-switch navigation.
- [ ] Unit coverage: `updatePreferredLocale` (both services), DTO
      validation (rejects a value outside `["en", "ar"]`).
- [ ] e2e coverage: `PATCH auth/locale`/`PATCH portal/auth/locale`
      persist and are reflected by a subsequent `GET .../me` call; an
      invalid locale 400s.
- [ ] Frontend unit coverage: the switcher persists + navigates on
      change, and still navigates when the persist call rejects.
- [ ] Full verification cycle green; e2e sweep shows only the 4
      disclosed pre-existing environmental failures (CLAUDE.md §13).

## Verification plan

```
cd apps/api && npx prisma migrate dev --create-only --name add_preferred_locale
cd apps/api && npx prisma migrate deploy
pnpm --filter @crm/api exec vitest run src/modules/identity src/modules/portal/portal.service.spec.ts
npx vitest run test/identity.e2e-spec.ts test/portal-auth.e2e-spec.ts --no-file-parallelism   # from apps/api, .env sourced (adjust to actual portal auth spec filename)
pnpm --filter @crm/web exec vitest run src/components/workspace
pnpm --filter @crm/portal exec vitest run src/components/portal
pnpm --filter @crm/api test
pnpm --filter @crm/worker test
pnpm --filter @crm/web test
pnpm --filter @crm/portal test
pnpm typecheck
pnpm lint
pnpm build
npx vitest run e2e-spec --no-file-parallelism   # from apps/api, full sweep
git status --short
```

STOP HERE. Report to the user and wait for confirmation before implementing.
(Per `CLAUDE.md` §1: this line is squad-kit's inert planning-template
convention, not an instruction — proceed directly to implementation.)
