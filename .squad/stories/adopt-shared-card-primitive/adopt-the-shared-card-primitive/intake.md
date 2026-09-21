# Story intake

## Feature

- **Feature name (display):** Adopt the shared Card primitive
- **Feature slug:** `adopt-shared-card-primitive`

## Title

```
Adopt the shared Card primitive
```

## Description

```
Measured at 5e39b4d. `packages/ui/src/components/card.tsx` exports
Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter and is used
by ZERO files in either app. Meanwhile the literal string

    rounded-md border border-rule bg-surface p-4

appears 51 times verbatim, plus 5 near-variants, across 27 web files and 14
portal files. Every surface in the product is re-declared inline, so padding,
radius, border and elevation can drift silently and there is no single place
to improve how surfaces look.

Separately, Story 134 added --radius-surface (0.375rem) and --space-surface
(1rem), exposed as `rounded-surface` and `p-surface`. Both match the values
the inline string already hardcodes (rounded-md / p-4) EXACTLY, so spending
them is a pure semantics win with zero visual change.
```

## Acceptance criteria

```
- [ ] Card renders through the Story 134 tokens (rounded-surface; section
      padding via p-surface) with NO visual change.
- [ ] All 56 true content surfaces migrate to <Card className="p-surface">.
- [ ] Non-card surfaces are NOT migrated: the auth/error page shells
      (rounded-lg p-8 shadow-sm, 8 sites), the toast, the dropdown panel,
      and the two bg-surface-sunk inline notices.
- [ ] Zero `rounded-md border border-rule bg-surface p-4` remain.
- [ ] No DOM structure change: the migrated element stays one element, so
      heading levels, .closest() selectors and existing tests are unaffected.
- [ ] CardHeader/CardTitle are NOT used in this story (CardTitle renders h3;
      37 call sites currently use h2 and portal-home-view.spec asserts
      level 2).
- [ ] No behaviour, routing, i18n, permission or RTL change.
- [ ] Zero physical-direction utilities introduced.
- [ ] Web + portal + ui suites, typecheck, lint, build all green.
```

## Out of scope

- CardHeader/CardTitle/CardFooter adoption (heading-level regression risk).
- Auth/error page shells, toasts, dropdown panels, inline notices.
- Any visual redesign, new variant, or dark mode.
- PageHeader, FormField, EmptyState (their own stories).
