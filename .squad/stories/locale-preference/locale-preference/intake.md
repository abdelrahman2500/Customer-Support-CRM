> **Source:** manual entry (autonomous CLAUDE.md loop, no external tracker).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/locale-preference/locale-preference/intake.md`

---

## Feature

- **Feature name (display):** i18n/RTL — Persisted locale preference + language switcher (agent + portal)
- **Feature slug (folder under `plans/`):** `locale-preference`

## Title

```text
Story 119 — i18n/RTL: Persisted locale preference + language switcher
```

## Description

```text
docs/architecture/10-i18n-and-rtl.md states: "Users have a stored
locale preference with a session override; portal customers choose
their locale independently." This was never built -- User and Contact
have no locale column, locale is 100% driven by the [locale] URL
segment, and neither app has any language-switcher UI (confirmed via
repo-wide grep). This story adds a nullable preferredLocale column to
both User and Contact, PATCH auth/locale / PATCH portal/auth/locale
endpoints to persist it, and an inline language switcher in each app's
own header, mirroring Story 118's branch-switcher UI pattern.
```

## Acceptance criteria

```text
- [ ] User.preferredLocale/Contact.preferredLocale added; GET
      auth/me / GET portal/auth/me include it.
- [ ] PATCH auth/locale / PATCH portal/auth/locale persist a valid
      locale; an invalid value 400s; no token reissue.
- [ ] WorkspaceNav and PortalHeader each render a language switcher
      that persists the choice and navigates to the same page in the
      new locale.
- [ ] A failed persist never blocks the actual language-switch
      navigation.
- [ ] Unit + e2e + frontend coverage for the above.
- [ ] Full verification cycle green; e2e sweep shows only the 4
      disclosed pre-existing environmental failures.
```

## Dependencies

- Story 118 — branch switcher (the UI/pattern this mirrors).
- The original i18n/RTL foundation — `next-intl`, `[locale]` routing,
  `routing.ts`'s configured `["en", "ar"]` locale list.

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- Automatic login-time redirect to a stored preferred locale.
- Any change to next-intl's own middleware/cookie mechanics.
- A locale field on any other entity (KB article locale is separate).
- Cross-device sync beyond the stored DB value.
- A shared UI package between apps/web and apps/portal.
