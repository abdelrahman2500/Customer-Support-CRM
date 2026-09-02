# locale-preference — plan overview

Entry point for the **locale-preference** feature.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 119 | [119-story-locale-preference.md](./119-story-locale-preference.md) | i18n/RTL — Persisted locale preference + language switcher (agent + portal) | — | Story 118 (branch switcher — the UI/pattern this mirrors), the original i18n/RTL foundation (`next-intl`, `[locale]` routing) |

## Dependency notes

- Selected via a fresh whole-repository Recon after Story 118, from a
  clean slate. This is the fifth gap found this session by the same
  pattern that surfaced Stories 115-118: a mechanism named directly in
  an architecture doc, never actually built.
- **The gap, confirmed directly**:
  `docs/architecture/10-i18n-and-rtl.md` states as a documented
  mechanism: "Users have a stored locale preference with a session
  override; portal customers choose their locale independently." This
  was never built — `User` (identity schema) and `Contact` (customers
  schema) have no locale column at all; locale is 100% driven by the
  `[locale]` URL segment (`next-intl`'s default middleware,
  `apps/web/src/middleware.ts`/`apps/portal/src/middleware.ts`, plain
  `createMiddleware(routing)`, no persistence logic anywhere). Neither
  app has any language-switcher UI — confirmed via a repo-wide grep for
  `LanguageSwitcher`/`switchLocale`/`setLocale` returning zero results
  in either app. The only way to change language today is to hand-edit
  the URL. `CLAUDE.md`'s own Mission section names full bilingual/RTL
  support as a first-class pillar of the Full CRM Vision, on par with
  multi-branch ticketing — yet after 118 stories it is unreachable
  through the UI in either app.
- **Why not externally blocked**: purely internal — no external
  provider/credential decision needed.
- **Design decisions this story makes**:
  - `preferredLocale String?` (nullable, no enum — Prisma enums cannot
    cross schemas, and `KbLocale` is KB-content-specific, an unrelated
    concern from Story 109) added to both `User` (identity) and
    `Contact` (customers). `null` (every existing account) means "no
    explicit choice yet" — mirrors `User.activeBranchId`'s own Story
    118 null-fallback convention exactly. Validated against exactly
    `routing.ts`'s own two configured locales (`"en"`/`"ar"`) via
    `@IsIn` in the DTO — never a third value, and never duplicated as a
    hardcoded list anywhere else.
  - `PATCH auth/locale` (agent) / `PATCH portal/auth/locale` (contact):
    unlike Story 118's `switchBranch`, no token reissue is needed —
    locale is not a JWT claim (`JwtAccessTokenClaims` carries
    authorization context only; locale is a presentation preference,
    read by the frontend from `GET /auth/me`/`GET /portal/auth/me`,
    which both already return `AuthenticatedUser`/`AuthenticatedContact`
    once those gain `preferredLocale`).
  - The switcher itself lives inline in each app's own header component
    (`WorkspaceNav`/`PortalHeader`), duplicated rather than shared —
    mirrors this codebase's own established convention of no shared UI
    package between `apps/web` and `apps/portal` (every existing
    cross-cutting concern — branding, notifications, sign-out — is
    separately implemented in each app's own header already). On
    change: best-effort `PATCH` (a failed persist never blocks the
    actual navigation — the user's intent to switch language now always
    succeeds locally, exactly like Story 118's branch switcher accepts
    a best-effort persist pattern for non-critical failures elsewhere
    in this codebase, e.g. `handleSignOut`'s own `logout()` try/catch),
    then a plain `router.push()` to the same pathname with the locale
    segment swapped — no `next-intl/navigation` helpers are used
    anywhere else in either app (confirmed by grep), so this doesn't
    introduce a new navigation pattern.
- **Scope-narrowing decisions** (see the story doc's own Non-Goals for
  the full list): no automatic login-time redirect to a stored
  preferred locale — the in-session switcher already gives a one-click
  path to the preferred locale from any locale-prefixed URL, and an
  auto-redirect heuristic (what about a bookmarked/shared link in a
  specific locale for a reason?) is a separate, smaller enhancement
  better deferred until real usage shows it's actually wanted; no
  change to `next-intl`'s own middleware/cookie mechanics; no locale
  field on any other entity (KB article locale, Story 109, is a
  separate, already-solved concern); no cross-device sync beyond what
  the stored DB value already gives on next `GET /auth/me`.
