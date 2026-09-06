# RM-12 — Locale-Routing Test Coverage

**Priority:** P2 · **Complexity:** Small · **Blocked:** No · **Phase:** 3 (Platform / Mobile)

## Goal

Add direct test coverage for locale routing, locale switching, and locale
fallback behavior in both `apps/web` and `apps/portal`.

## Why it exists

`apps/web/src/i18n/{request,routing}.ts` and `apps/portal/src/i18n/
{request,routing}.ts` have no dedicated spec file — confirmed by direct
listing. Locale-aware rendering is exercised only incidentally, inside many
component specs that happen to render translated strings; there is no test
that asserts the routing/switching/fallback behavior itself. The
translations themselves are confirmed complete (0 missing keys either
app) — this gap is specifically about the routing mechanism, not the
translation content.

## Dependencies

None.

## Backend work

None.

## Frontend work

None (test-only story).

## Worker/realtime work

None.

## Schema/migration work

None.

## Tests

- New `routing.spec.ts` for both `apps/web/src/i18n` and `apps/portal/src/
  i18n`, asserting: the `[locale]` segment resolves `en`/`ar` correctly, an
  unsupported locale segment falls back to the configured default locale
  rather than 404ing or crashing, and `request.ts`'s message-loading
  resolves the correct message file per locale.
- One end-to-end-flavored test (Vitest or the existing Playwright suite)
  asserting a locale switch (e.g. via the existing language-selector
  control) actually changes both the rendered text and the `dir` attribute
  correctly.

## Acceptance criteria

- Locale routing, an unsupported-locale fallback, and a live locale switch
  are all directly asserted by tests, in both apps.
- No production code change is required to pass these tests unless the
  tests themselves surface a real, previously-untested defect — if so,
  document it and fix the minimum necessary (per `CLAUDE.md` §4), not
  otherwise expand this story's scope.

## Definition of Done

- All acceptance criteria verified.
- `pnpm --filter @crm/web test`, `pnpm --filter @crm/portal test` pass.
- One dedicated commit, pushed.
