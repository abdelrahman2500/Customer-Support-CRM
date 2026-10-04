# Design Language (UI/UX)

The visual and interaction language of both frontends (`apps/web`, `apps/portal`). The binding source for colour, typography, spacing, shape, motion, status semantics, theming and branch branding. Its rationale and the Story-by-Story rollout live in [`.squad/plans/crm-ui-ux-redesign/00-overview.md`](../../.squad/plans/crm-ui-ux-redesign/00-overview.md). A change to a decision here must update this file and say so in its Story.

## Layers

| Layer | Location | Rule |
|---|---|---|
| Tokens | `packages/config/tailwind-tokens.css` (CSS variables, RGB channels), `packages/config/tailwind-preset.js` | The only place colour, radius, elevation, spacing and type values are defined. Light, dark and branch-brand values live here as variables. |
| Generic primitives | `packages/ui` | Domain-free: no i18n dependency, no ticket/customer types; every string arrives as a prop. |
| Shared presentation data | `packages/shared` | Pure constants both apps need (e.g. ticket status → tone + icon key). No React. |
| CRM patterns | `apps/*/src/components/**` | Domain rendering built on primitives. Moves into `packages/ui` only as a domain-free shell when both apps need the same rendering. |

New primitives are introduced in the Story of their first consumer, never speculatively.

## Colour

Semantic tokens only. Raw Tailwind palette classes (`bg-red-50`, `text-emerald-600`, …) and hex values are not used in component code. Each family has light and dark values; components never branch on theme.

- **Neutrals:** `surface-sunk` (canvas) · `surface` (panels) · `surface-raised` (menus, dialogs, sticky bars) · `surface-muted` (hover/selected). Text `ink` › `ink-strong` › `ink-muted` › `ink-subtle`. Borders `rule-subtle` › `rule` › `rule-strong`, plus `rule-control` for the boundary of every form control (≥ 3:1).
- **Accent (core):** indigo. `accent` / `accent-hover` / `accent-active` / `accent-foreground` / `accent-surface`. Light `#4F46E5`, dark `#818CF8`.
- **Focus:** `focus` (light `#4338CA`, dark `#A5B4FC`). Never branch-overridden.
- **Semantic families:** `success`, `warning`, `danger`, `info` (sky), `progress` (violet, "work in progress"). Steps: `subtle` / `surface` / `border` / `solid` / `foreground`. **Only `foreground` is used for text**; `solid` is for fills, icons and indicators.
- Every text/background pair used by the system meets WCAG 2.x AA (4.5:1 text, 3:1 non-text) in both themes.

## Status semantics

Status is always **icon + localized label + tone**; colour is never the only signal.

| Concept | Values → tone |
|---|---|
| Ticket status | OPEN → `info` · IN_PROGRESS → `progress` · RESOLVED → `success` · CLOSED → neutral |
| Ticket priority | LOW / MEDIUM → neutral · HIGH → `warning` · URGENT → `danger` |
| SLA | on-track → neutral · at-risk → `warning` · breached → `danger` · on-hold → neutral |

Statuses never use `warning`/`danger`; priorities never use `info`/`progress`. **At-risk** is a presentation tier only: the governing target has ≤ 25% of its window (measured from ticket creation) or ≤ 60 minutes remaining, whichever comes first. It changes no business rule.

## Theme

- Light, dark and **system** (default). Mechanism: `:root` (light), `:root[data-theme="dark"]`, and `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`; `color-scheme` follows the theme.
- Preference: the `crm-theme` cookie (`light` | `dark` | `system`). An explicit light/dark is put on `<html>` before first paint by a blocking inline `ThemeScript` (`@crm/ui`) in each root `<head>`; "system" needs no script. The cookie is deliberately not read on the server, which would make the statically generated `[locale]` layouts dynamic. No per-user database preference.
- Depth in dark mode comes from lighter surfaces (`sunk` < `surface` < `raised`), not shadows.
- Uploaded branch logos sit on a light logo plate in dark mode.
- `dark:` utilities are a last resort and confined to `packages/ui`.

## Branch branding

- **Tier 1 — identity (always):** `logoUrl`, `appName`, and the raw `primaryColor` as `--brand` on decorative surfaces only (header brand edge, active-nav indicator, brand panels). `secondaryColor` is a decorative gradient partner only, never text.
- **Tier 2 — interactive accent (only when it passes):** the `accent` family is derived from `primaryColor` by `deriveBrandTokens` (`packages/ui/src/lib/brand.ts`). The result must reach the core accent's contrast in both themes, stay recognisable, not be neutral, and not sit in the danger-red hue range. Otherwise the core indigo stays.
- **Never branch-overridden:** neutrals, `focus`, every semantic family, status/priority/SLA tones, chart semantics.

## Typography

IBM Plex Sans + IBM Plex Sans Arabic (400/500/600). Named scale only: `caption` 12 · `label` 12/600 · `body-sm` 13 · `body` 14 (default UI) · `body-lg` 16 (reading) · `subhead` 16/600 · `heading` 18/600 · `title` 24/600 (page `h1`) · `display` 30/600 (KPIs, `tabular-nums`).

Arabic: no `uppercase`, no letter-spacing (`:lang(ar)` resets it), slightly taller line-height. Arabic UI keeps `Intl`'s default Arabic-Indic digits. All dates, times and numbers go through `Intl` with the active locale.

## Spacing, shape, elevation, density

- **Spacing tokens:** `tight` .25 · `inline` .5 · `stack` .75 · `surface` 1 · `section` 1.5 · `shell` 2 rem; `page-x`/`page-y` are responsive (1rem → 1.5rem at `sm` → 2rem at `lg`).
- **Radius:** `control` 8px (buttons, inputs) · `surface` 12px (cards, dialogs, sheets) · `inner` 6px (nested items) · `pill`.
- **Elevation:** `shadow-resting` (cards) · `shadow-raised` (menus, sticky bars) · `shadow-overlay` (dialogs, sheets, toasts).
- **Density:** comfortable by default (controls 40px, `sm` 32px, `lg` 44px). Data-heavy tables use `Table density="compact"` inside comfortable page chrome. Targets ≥ 24px; primary touch targets ≥ 40px below `sm`.

## Iconography

lucide only, through `packages/ui/src/lib/icons.ts`. 16px inline, 20px navigation/section, 24px empty states. Icons accompany text; icon-only controls carry an accessible name and tooltip. Directional icons (back, chevrons, send, reply) flip in RTL; non-directional ones (clock, check, search, paperclip, lock) never do.

## Motion

`duration-fast` 120ms (hover/press) · `duration-base` 180ms (menus, toasts) · `duration-slow` 240ms (dialogs, sheets); easing `cubic-bezier(.2,0,0,1)`. Sheets enter from the inline-end edge. All motion respects `prefers-reduced-motion`; motion never carries meaning alone.

## Principles

Conversation first · the header owns state and action · hierarchy over decoration · meaning is never colour-only · one pattern per job · comfortable shell, efficient data · progressive disclosure without hiding capability · parity by construction (ar/en, RTL/LTR, light/dark, every brand) · accessible by default · presentation, not behaviour.
