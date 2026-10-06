# Design Language (UI/UX)

The visual and interaction language of both frontends (`apps/web`, `apps/portal`). The binding source for colour, typography, spacing, shape, motion, status semantics, theming and branch branding. Its rationale and rollout live in [`.squad/plans/crm-ui-ux-redesign/00-overview.md`](../../.squad/plans/crm-ui-ux-redesign/00-overview.md) (foundation, Stories 177–209) and, for the current visual language v2, [`.squad/plans/crm-product-redesign/visual-direction.md`](../../.squad/plans/crm-product-redesign/visual-direction.md) (Stories 210–235). A change to a decision here must update this file and say so in its Story.

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

- **Neutrals:** `surface-sunk` (canvas — a warm paper neutral `#F6F5F2` in light mode since v2) · `surface` (panels) · `surface-raised` (menus, dialogs, sticky bars) · `surface-muted` (hover/selected). Text `ink` › `ink-strong` › `ink-muted` › `ink-subtle`. Borders `rule-subtle` › `rule` › `rule-strong`, plus `rule-control` for the boundary of every form control (≥ 3:1).
- **Accent (core):** indigo. `accent` / `accent-hover` / `accent-active` / `accent-foreground` / `accent-surface`. Light `#4F46E5`, dark `#818CF8`.
- **Focus:** `focus` (light `#4338CA`, dark `#A5B4FC`). Never branch-overridden.
- **Semantic families:** `success`, `warning`, `danger`, `info` (sky), `progress` (violet, "work in progress"). Steps: `subtle` / `surface` / `border` / `solid` / `foreground`. **Only `foreground` is used for text**; `solid` is for fills, icons and indicators.
- **Chrome (v2):** the ink navigation rail and header band — `chrome` / `chrome-raised` (hover) / `chrome-active` (current item) / `chrome-rule` / `chrome-ink` / `chrome-muted` / `chrome-accent`. The same deep ink (`#0E1726`) in both themes. A chrome surface carries `.on-chrome`, which scopes the focus ring to `chrome-accent`.
- **Data visualisation (v2):** `viz-1` … `viz-6` (indigo, teal, amber, pink, sky, slate; lighter steps in dark), categorical and colour-blind-safe in that order, never branded. Status-encoded charts use the status tones instead. Colour is always paired with a label.
- Every text/background pair used by the system meets WCAG 2.x AA (4.5:1 text, 3:1 non-text) in both themes.

## Status semantics

Status is always **icon + localized label + tone**; colour is never the only signal.

| Concept | Values → tone |
|---|---|
| Ticket status | OPEN → `info` · IN_PROGRESS → `progress` · RESOLVED → `success` · CLOSED → neutral |
| Ticket priority | LOW / MEDIUM → neutral · HIGH → `warning` · URGENT → `danger` |
| SLA | on-track → neutral · at-risk → `warning` · breached → `danger` · on-hold → neutral |

Statuses never use `warning`/`danger`; priorities never use `info`/`progress`. **Status spine (v2):** each status's `solid` tone (CLOSED: `rule-control`) is also its 3px spine — the top edge of its board column and of the ticket header (both apps), its dot, its distribution-bar segment, and the inline-start edge of a portal ticket card. One source: `toneSpine(tone)` in `@crm/ui` (`border` / `dot` / `top` / `start`), fed by `@crm/shared`'s `ticketStatusPresentation`, so customers and agents see the same hue. HIGH/URGENT tickets add a 3px inline-start **urgency edge** in `warning-solid`/`danger-solid`; other priorities stay neutral. **At-risk** is a presentation tier only: the governing target has ≤ 25% of its window (measured from ticket creation) or ≤ 60 minutes remaining, whichever comes first. It changes no business rule.

## Theme

- Light, dark and **system** (default). Mechanism: `:root` (light), `:root[data-theme="dark"]`, and `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`; `color-scheme` follows the theme.
- Preference: the `crm-theme` cookie (`light` | `dark` | `system`). An explicit light/dark is put on `<html>` before first paint by a blocking inline `ThemeScript` (`@crm/ui`) in each root `<head>`; "system" needs no script. The cookie is deliberately not read on the server, which would make the statically generated `[locale]` layouts dynamic. No per-user database preference.
- Depth in dark mode comes from lighter surfaces (`sunk` < `surface` < `raised`), not shadows.
- Uploaded branch logos sit on a light logo plate in dark mode.
- **Portal chrome (v2):** lighter than the agent's ink chrome — a white (`surface`) header with the 3px brand stripe along its top and a hairline shadow, its row on the content's reading width (`max-w-5xl`). Branding is read server-side and seeded into the query, so the first paint already carries it.
- `dark:` utilities are a last resort and confined to `packages/ui`.

## Branch branding

- **Tier 1 — identity (always):** `logoUrl`, `appName`, and the raw `primaryColor` as `--brand` on decorative surfaces only (header brand edge, active-nav indicator, brand panels). `secondaryColor` is a decorative gradient partner only, never text.
- **Tier 2 — interactive accent (only when it passes):** the `accent` family is derived from `primaryColor` by `deriveBrandTokens` (`packages/ui/src/lib/brand.ts`). The result must reach the core accent's contrast in both themes, stay recognisable, not be neutral, and not sit in the danger-red hue range. Otherwise the core indigo stays.
- **Never branch-overridden:** neutrals, `focus`, every semantic family, status/priority/SLA tones, chart semantics.

## Typography

IBM Plex Sans + IBM Plex Sans Arabic (400/500/600). Named scale only: `caption` 12 · `label` 12/600 · `body-sm` 13 · `body` 14 (default UI) · `body-lg` 16 (reading) · `subhead` 16/600 · `heading` 18/600 · `title` 24/600 (page `h1`) · `display` 30/600 (KPIs, `tabular-nums`).

Arabic: no `uppercase`, no letter-spacing (`:lang(ar)` resets it), slightly taller line-height. The Arabic UI shows **Latin digits** (product redesign PD-8, superseding the earlier Arabic-Indic intent). Dates and times go through `Intl` with the active locale (`formatDate`/`formatTime` in `@crm/ui`), which gives Latin digits for `ar` in this runtime; formatted numbers whose `Intl` output could differ — currency, percentages, decimals on Reports — pin it with the `-u-nu-latn` extension. Story 233 verified every route in Arabic carries no Arabic-Indic digit. Durations use translated units. Counts, times and KPIs use `tabular-nums`.

**Mixed direction:** text a person wrote can run in the other direction from the UI. Single-line user text (page titles, ticket subjects, article titles, customer and sender names) is isolated with `<bdi>`, which keeps the surrounding alignment; multi-line user text (messages, article bodies, comments) takes its direction from its own content with `dir="auto"`. `PageHeader` and `MessageBubble` do this themselves.

## Spacing, shape, elevation, density

- **Spacing tokens:** `tight` .25 · `inline` .5 · `stack` .75 · `surface` 1 · `section` 1.5 · `shell` 2 rem; `page-x`/`page-y` are responsive (1rem → 1.5rem at `sm` → 2rem at `lg`).
- **Radius:** `control` 8px (buttons, inputs) · `surface` 12px (cards, dialogs, sheets) · `inner` 6px (nested items) · `pill`.
- **Elevation (v2 — borders before shadows):** four levels only. 0 flat on the canvas · 1 a card: `surface` + hairline, no shadow · 2 `shadow-raised`, only on the hover of something that can be picked up · 3 `shadow-overlay` for anything floating (dragged card, menu, popover, sheet, dialog, toast). The named recipes — `card`, `column`, `inner`, `liftable`, `floating`, `chrome` — are exported as `recipes` from `@crm/ui` (`packages/ui/src/lib/recipes.ts`).
- **Density:** comfortable by default (controls 40px, `sm` 32px, `lg` 44px). Data-heavy tables use `Table density="compact"` inside comfortable page chrome. Targets ≥ 24px; primary touch targets ≥ 40px below `sm`.

## Iconography

lucide only, through `packages/ui/src/lib/icons.ts`. 16px inline, 20px navigation/section, 24px empty states. Icons accompany text; icon-only controls carry an accessible name and tooltip. Directional icons (back, chevrons, send, reply) flip in RTL; non-directional ones (clock, check, search, paperclip, lock) never do.

## Motion

`duration-fast` 120ms (hover/press) · `duration-base` 180ms (menus, toasts) · `duration-slow` 240ms (dialogs, sheets); easing `cubic-bezier(.2,0,0,1)`. Sheets enter from the inline-end edge. All motion respects `prefers-reduced-motion`; motion never carries meaning alone.

## Accessibility contract

- Every page has a document title, "<page> · <product>": a page exports `generateMetadata = pageTitle(namespace, key)` (its nav label) and the locale layout supplies the template.
- Exactly one `h1` per page and per state (loading, error, not found).
- An inline error that appears because something failed carries `role="alert"` (`role="status"` for validation shown while typing). Conversations are polite `role="log"` regions; progress such as "Thinking…" is a mounted `role="status"`.
- Every control is named by a real label, never only by a placeholder; text fields stay enabled while their submit is pending.
- Guards in `apps/web/src/test/` (`a11y-guards`, `table-mobile-labels`, `style-guard`, `token-contrast`) keep these from regressing.

## Primitives and patterns index

`@crm/ui` (`packages/ui/src/components`), by job:

| Job | Primitives |
|---|---|
| Actions | `Button`, `DropdownMenu`, `ConfirmDialog`, `AlertDialog` |
| Forms | `FormField`, `FormSection`/`FormActions` (`form-layout`), `Input`, `PasswordInput`, `Textarea`, `Select`, `NativeSelect`, `Combobox`, `Checkbox`, `Switch`, `Label`, `FileDropzone`, `SegmentedControl` |
| Surfaces | `Card`/`SectionCard`, `Dialog`, `Sheet`, `Popover`, `Tooltip`, `Separator`, `Tabs` |
| Page frame | `PageHeader`, `BackLink`, `AuthLayout`, `BrandScope`, `ThemeScript`/`ThemeSwitcher`, `NavigationOverlay` |
| Lists and data | `ListToolbar`, `FilterBar`/`FilterSelect`, `Table` (mobile card rows), `Pagination`, `SortIndicator`, `DescriptionList`, `Board`/`BoardColumn`, `StatCard`, charts (`BarChart`, `DonutGauge`, `RatingBar`, `DistributionBar`) |
| Status | `Badge`, `ActiveBadge`, `Avatar`, `Kbd`, `toneSpine` |
| States | `QueryStateCard`, `EmptyState`, `ErrorState`, `LoadingStatus`, `Skeleton`, `Spinner`, `FetchingIndicator`, `Alert`, `SuccessToaster` |
| Conversation | `MessageThread` (`fill` for full-height pages), `MessageBubble`, `Composer` |

CRM patterns (in the apps): the tickets board and its moves (`apps/web/src/components/tickets/board`), the ticket header and inspector, the unified timeline (`ticket-chat-card`), `CreateDialog` for multi-field admin creates, URL-backed filters (`lib/url-filters.ts`), the portal `TicketCard` and `StillNeedHelp`. A pattern moves into `@crm/ui` only as a domain-free shell when both apps need the same rendering.

## Visual regression

A local screenshot baseline of the hero screens (both logins, dashboard, board, ticket, portal home and ticket × en/ar × light/dark × 1280/390) lives in `apps/e2e/visual` (`pnpm --filter @crm/e2e test:visual`; see `playwright.visual.config.ts`). It is not a CI gate (PD-9).

## Principles

**v2:** wow on first impression, comfortable after eight hours — workflow first, decoration never · one signature used consistently (ink chrome, status spine, urgency edge, tabular numerals, hairlines) · colour means something, so it is scarce · borders before shadows · motion explains change · dense where people scan, airy where they read. **Foundation:** conversation first · the header owns state and action · hierarchy over decoration · meaning is never colour-only · one pattern per job · comfortable shell, efficient data · progressive disclosure without hiding capability · parity by construction (ar/en, RTL/LTR, light/dark, every brand) · accessible by default · presentation, not behaviour.
