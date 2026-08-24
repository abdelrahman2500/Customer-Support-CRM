# Internationalization (Arabic/English) & RTL

## Content strategy

- UI strings use `next-intl` JSON catalogs (`messages/en.json` and `messages/ar.json`) in both apps; components contain no hardcoded UI text.
- Translatable user/domain content, such as Knowledge Base articles, uses a per-entity translations pattern: one row per entity/locale/field or a locale-keyed JSON column, decided by the feature story.
- Users have a stored locale preference with a session override; portal customers choose their locale independently.

## RTL strategy

- The root layout sets `dir="rtl"` for `ar` and `dir="ltr"` otherwise, driven by `next-intl`.
- Tailwind uses logical utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`) instead of physical left/right utilities.
- shadcn/ui and Radix components inherit RTL behavior from the ancestor `dir` attribute.
- Directional icons are flipped with a scoped `[dir="rtl"]` rule as each component requires.

## Formatting

Dates, numbers, and currency use locale-driven `Intl.DateTimeFormat` and `Intl.NumberFormat`, never manual strings. Each branch stores an IANA timezone for SLA business-hours calculations and timestamp display; timezone and UI language remain separate concerns.
