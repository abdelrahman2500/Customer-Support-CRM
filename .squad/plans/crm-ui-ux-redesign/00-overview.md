# crm-ui-ux-redesign — master overview

Entry point for the **CRM UI/UX redesign** track. Evidence base: [`recon.md`](./recon.md) (audit of `main` @ `3461bcf`). Finding IDs such as `TW-01`, `VL-04` and `A11Y-02` refer to that report.

Story IDs here are **track IDs** (`RD-<phase>.<n>`). Repository Story numbers (`feat(story-NN)`) are assigned when each Story is picked up; the next free number at the time of writing is **177**. Each Story gets its own `NN-story-<slug>.md` plan when it is selected, per `CLAUDE.md` §3.

Status: **planning only**. Nothing in this document has been implemented.

> **Active roadmap moved (2026-10-05).** RD-0.1 … RD-3.9 are **complete** (Stories 177–209; see [`progress.md`](./progress.md)) and remain the foundation of the product. The **active roadmap** is now the product redesign track [`../crm-product-redesign/00-overview.md`](../crm-product-redesign/00-overview.md) (Stories 210–235). The unstarted items here (RD-3.10 … RD-7.8) are **not cancelled**: each is merged into a Story of that track (its §3 maps every item and the findings it cites), and none is implemented individually from this document. This document stays as the historical plan and reference for the completed work.

---

## 1. Executive Summary

### Current state
The CRM has solid foundations:
- a semantic, RGB-channel token layer shared by both apps (`packages/config/tailwind-tokens.css`, `tailwind-preset.js`)
- a domain-free `@crm/ui` package with ~30 tested components
- zero physical-direction CSS
- a mature accessibility setup: skip links, focus tokens, `FormField` ARIA wiring, announced loading states
- mobile-stacking tables
- a two-column ticket page (Story 156)
- a modern login screen (Story 175)

### Primary problems (from recon)
1. **No visual identity.** The accent is slate-900, branding only tints a 2px border, and there is no dark mode (`VL-01`, `DS-01`, `DS-06`).
2. **The ticket workspace is a stack of 11 equal cards.** It has no state/action header, no unified timeline, two composers, and nothing sticky (`TW-01`, `TW-02`, `TW-04`, `TW-05`).
3. **Status semantics collide and are duplicated.** OPEN and HIGH share amber; there are 3 SLA renderings and no at-risk tier (`VL-04`, `TW-09`).
4. **Arabic users see raw enums and units** in filters, history, portal priority, toasts and SLA time (`TK-01`, `TW-10`, `PT-04`, `TK-08`).
5. **Hierarchy is flat.** Everything is a card, and the type scale is mostly unused (`VL-02`, `VL-03`, `DS-03`).
6. **Admin screens edit inside table rows**, and `Dialog` has 0 usages (`AD-01`, `DS-07`).
7. **Shared primitives are under-adopted:** 73+4 hand-rolled labels, ~15 hand-rolled state blocks, and 4 filter-row implementations (`VL-07`, `VL-08`).
8. **The portal feels unfinished:** no width cap, thin ticket creation, a chat with no `h1` and no live region, and dead-end errors (`PT-01`, `PT-06`, `A11Y-01`, `A11Y-03`).

### Redesign goal
Turn the product into a **polished, modern, professional customer-support CRM** that reads as one product across Agent Web and Customer Portal. It must work in Arabic and English, RTL and LTR, light and dark, and with branch branding. All existing functionality, routing, APIs, business rules, accessibility and responsive behaviour must be preserved.

### Design philosophy
**Evolve, don't replace.** The token architecture and `@crm/ui` are kept and re-skinned. Layouts are re-composed around the support agent's real loop:

> read the latest message → check context and SLA → reply or note → set status → next ticket.

Colour carries meaning, never decoration alone. Every status has a label and an icon. The brand is expressed in controlled places so the product stays recognisable for every branch.

---

## 2. Design Direction

All values below are **recommendations to be encoded in Phase 1**. Contrast ratios were **computed** (WCAG 2.x relative luminance) for this document, not estimated.

### 2.1 Visual identity

**Positioning:** calm, precise, trustworthy. The tone should feel like a professional operations tool that is pleasant to sit in for an 8-hour shift. It should not look like a marketing site.

**Core accent: Indigo.** Rationale:
- **It separates "brand/action" from "information".** Today the only chromatic colours are the focus/info blues. Indigo leaves sky-blue free for the `info` semantic and for the OPEN status, so the primary button never looks like an informational state.
- **It collides with no semantic.** Green = success, amber = warning, red = danger are all reserved. Indigo is far from all three. A green or teal accent would compete with "resolved/success".
- **It is culturally neutral** for a bilingual Arabic/English product. It carries no national or religious association in MENA markets, unlike green, and no alarm association, unlike red/orange.
- **It is accessible in both modes:**
  - light: indigo-600 carries white text at **6.29:1**
  - dark: indigo-400 carries slate-900 text at **5.98:1**
- **It pairs naturally with the existing slate neutrals,** which the product already uses and which recon found to be well-calibrated.
- **It reads as modern SaaS.** Indigo/violet-leaning blues are the established "product UI" family. That gives a familiar, credible feel without copying a specific competitor.

### 2.2 Colour tokens

Token names **keep the existing families** (`surface`, `ink`, `rule`, `accent`, `success`/`warning`/`danger`/`info`). This lets every current class (`bg-surface`, `text-ink-muted`, `bg-accent` …) re-skin without screen edits.

Additions are marked **NEW**; value changes are marked **CHG**. All are RGB-channel CSS variables, exactly as today.

#### Neutral surfaces

| Token | Role | Light | Dark |
|---|---|---|---|
| `surface-sunk` | Page canvas behind content | `#F8FAFC` | `#020617` |
| `surface` | Cards, panels, inputs, header | `#FFFFFF` | `#0F172A` |
| `surface-raised` **NEW** | Popovers, menus, dialogs, sticky bars | `#FFFFFF` | `#1E293B` |
| `surface-muted` | Hover, selected, inset, active nav | `#F1F5F9` | `#273449` |
| `overlay` | Dialog/sheet scrim (used at `/50` light, `/60` dark) | `#020617` | `#000000` |

#### Text hierarchy

| Token | Use | Light (ratio on surface / on muted) | Dark (ratio on surface / on muted) |
|---|---|---|---|
| `ink` | Primary text, headings | `#0F172A` (17.85) | `#F1F5F9` (16.30) |
| `ink-strong` | Emphasised body, labels | `#1E293B` | `#E2E8F0` (14.48) |
| `ink-muted` | Secondary text | `#475569` (7.58 / 6.92) | `#B4BFCF` **CHG** (9.60 / 6.75) |
| `ink-subtle` | Meta, captions, placeholders | `#5E6B80` **CHG** from `#64748B` (5.40 / 4.93) | `#94A3B8` (6.96 / 4.89) |

> **Why `ink-subtle` changes in light mode:** today's slate-500 measures **4.34:1 on `surface-muted`** and **4.26:1 on `accent-surface`**, so meta text on hovered or selected rows fails AA. `#5E6B80` passes on every light surface (≥ 4.83).

#### Border hierarchy

| Token | Use | Light | Dark |
|---|---|---|---|
| `rule-subtle` | Row dividers | `#F1F5F9` | `#172033` |
| `rule` | Card/panel borders (decorative) | `#E2E8F0` | `#1E293B` |
| `rule-strong` | Emphasised dividers, outline buttons | `#CBD5E1` | `#334155` |
| `rule-control` **NEW** | **Boundaries of inputs, selects, checkboxes** | `#7B8AA0` (3.51 on surface, 3.35 on sunk) | `#64748B` (3.75 on surface, 3.07 on raised) |

> **Why `rule-control` is new:** form controls currently use `rule-strong` (`#CBD5E1`), which measures **1.48:1** against white. That is below the **3:1** WCAG 1.4.11 requires for the visual boundary of a control. Decorative card borders stay soft; control borders become perceivable.

#### Accent (core; branch-overridable only through §2.13's gates)

| Token | Light | Dark |
|---|---|---|
| `accent` | `#4F46E5` **CHG** (indigo-600) | `#818CF8` (indigo-400) |
| `accent-hover` | `#4338CA` | `#A5B4FC` (dark mode lightens on hover) |
| `accent-active` **NEW** | `#3730A3` | `#6366F1` |
| `accent-foreground` | `#FFFFFF` (6.29 on accent) | `#0F172A` (5.98 on accent) |
| `accent-surface` | `#EEF2FF` (accent text 7.07 on it) | `#1E1B4B` (`#A5B4FC` text 8.02 on it) |

The accent used as link text measures 6.29 (light, on surface) and 5.98 (dark, on surface; 4.90 on raised). Both are AA.

#### Focus

| Token | Light | Dark |
|---|---|---|
| `focus` | `#4338CA` **CHG** (7.90 on surface, 7.55 on sunk) | `#A5B4FC` (8.96 on surface, 7.34 on raised) |

Focus is **never** branch-overridden (§2.13).

#### Semantic colours

Same five steps as today: `subtle` / `surface` / `border` / `solid` / `foreground`.

**Rule:** `foreground` is the **only** step used for text. `solid` is for fills, icons and indicators (≥ 3:1 required). Today `text-danger-solid` appears as text in several places; in dark mode `#DC2626` on `#0F172A` is only 3.70:1, so those uses must move to `danger-foreground` (RD-1.3).

| Family | Light: subtle / surface / border / solid / fg | fg on surface | Dark: subtle / surface / border / solid / fg | fg on surface |
|---|---|---|---|---|
| `success` | `#ECFDF5` / `#D1FAE5` / `#A7F3D0` / `#059669` / `#065F46` | 6.78 | `#031F18` / `#022C22` / `#065F46` / `#34D399` / `#6EE7B7` | 9.94 |
| `warning` | `#FFFBEB` / `#FEF3C7` / `#FDE68A` / `#B45309` **CHG** / `#92400E` | 6.37 | `#2A1203` / `#3B1A04` / `#92400E` / `#FBBF24` / `#FCD34D` | 10.91 |
| `danger` | `#FEF2F2` / `#FEE2E2` / `#FECACA` / `#DC2626` (hover `#B91C1C` **CHG**) / `#991B1B` | 6.80 | `#2B0B0D` / `#3F1214` / `#991B1B` / `#DC2626` (hover `#B91C1C`) / `#FCA5A5` | 8.46 |
| `info` | `#F0F9FF` / `#E0F2FE` / `#BAE6FD` / `#0284C7` / `#075985` **CHG** (sky, was blue) | 6.59 | `#061A2B` / `#082F49` / `#075985` / `#38BDF8` / `#7DD3FC` | 8.32 |
| `progress` **NEW** | `#F5F3FF` / `#EDE9FE` / `#DDD6FE` / `#7C3AED` / `#5B21B6` | 7.57 | `#1C0B3D` / `#2E1065` / `#5B21B6` / `#A78BFA` / `#C4B5FD` | 8.25 |

**Corrections to today's values:**
- **`danger-solid-hover`:** today `#EF4444` (red-500) with white text measures **3.76:1**, which fails. It becomes the darker `#B91C1C` (6.47).
- **`warning-solid`:** `#D97706` measures **3.19:1** as an icon on white. It moves to `#B45309` (5.02).
- **`info` moves from blue to sky**, so it no longer sits next to the indigo accent.

**`progress`** is a status tone for "work in progress". It is the only new hue family, needed so the four ticket statuses get four distinct, non-alarming tones (§2.3).

#### Dead aliases
The shadcn-style aliases (`--primary`, `--muted-foreground`, …) are defined but mapped to nothing (`DS-02`). They are **removed** in RD-1.1, because nothing consumes them (0 uses). `apps/web/components.json` stays, but any future shadcn-CLI output must be rewritten onto the semantic tokens.

### 2.3 Status vocabulary (CRM semantic layer)

Status is always shown as **icon + localized label + tone**. Colour is the third signal, never the only one.

| Concept | Value | Tone | Icon (lucide, via `ui/lib/icons.ts`) |
|---|---|---|---|
| Ticket status | `OPEN` | `info` | circle-dot |
| | `IN_PROGRESS` | `progress` | circle-dashed / half-circle |
| | `RESOLVED` | `success` | circle-check |
| | `CLOSED` | neutral (`secondary`) | archive |
| Ticket priority | `LOW` | neutral subtle | signal-low |
| | `MEDIUM` | neutral | signal-medium |
| | `HIGH` | `warning` | signal-high |
| | `URGENT` | `danger` | alert-triangle |
| SLA (`web/lib/sla.ts` kinds) | `on-track` | neutral text + clock icon | clock |
| | `at-risk` **NEW, presentation-only** | `warning` | clock-alert / alarm |
| | `breached` | `danger` | alert-octagon |
| | `on-hold` | neutral | pause-circle |
| | `none` | not rendered | — |

**Resolving the recon collision:**
- Statuses never use `warning`/`danger`. Priorities never use `info`/`progress`.
- An open urgent ticket therefore shows a **blue status pill next to a red priority pill**, not two identical ambers.

**At-risk tier:** derived on the client from data the API already returns (`responseTargetAt`, `resolutionTargetAt`, `onHoldSince`). The threshold is an approval item (§12). No business rule changes; it is a display tier only.

**Which target governs:** `deriveSlaStatus` already picks the earlier target. The redesign surfaces *which* one it picked ("First response" or "Resolution") as a label.

### 2.4 Light mode
The default for users with no preference. Canvas `surface-sunk` with `surface` panels. Elevation comes from a hairline border plus a resting shadow. Accent is used sparingly: primary actions, links, selected navigation, focus-adjacent states.

### 2.5 Dark mode (in scope from the start)

**Not an inversion.** Separate, tuned values per token (§2.2). Depth comes from **lighter surfaces** (`sunk` < `surface` < `raised`) rather than shadows. Shadows are kept, but darkened (`rgb(0 0 0 / 0.5)`).

**Mechanism.** Tokens only; no scattered `dark:` classes:
- `:root { …light… }`
- `:root[data-theme="dark"] { …dark… }`
- `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { …dark… } }`. This covers "system" with no script, so there is no flash.
- `color-scheme: light` / `dark` is set per mode, so native controls (date input, scrollbars, file input) follow.
- Tailwind 3.4's `darkMode: ["variant", […]]` is configured in both apps to the same selectors. This is for the rare unavoidable `dark:` case. A guard spec (RD-1.3) restricts `dark:` to `packages/ui` and limits its count.

**Preference:**
- **Default value:** `system`, with explicit light and dark choices.
- **Storage:** a `crm-theme` cookie (`light` | `dark` | `system`), read in each app's server `[locale]/layout.tsx` (and the root not-found layout from `3461bcf`) to set `data-theme` on `<html>` before paint. This mirrors how `NEXT_LOCALE` already works (`web/i18n/cookie-locale.ts`).
- **No database column:** a per-user server-side theme would need a schema change, which is out of scope (§12).

**Items that need explicit dark treatment:**
- **Charts.** `report-charts.tsx` already reads CSS variables, so charts follow the theme automatically. They are still checked in RD-6.8.
- **Branch logos.** These are arbitrary uploads, often dark-on-transparent. In dark mode they render on a light "logo plate" (`surface` light value, `rounded-inner`, small padding) unless a future Story adds a dark-logo field (§10).
- **Raw palette classes.** `emerald` / `amber` / `red` would not adapt. They are removed in RD-1.3 *before* dark mode ships.
- **`text-danger-solid` used as text.** It must move to `danger-foreground` (see §2.2).

### 2.6 Typography

**Fonts.** Keep IBM Plex Sans + IBM Plex Sans Arabic (weights 400/500/600, `next/font`). It is a deliberate bilingual pairing with matched metrics, and the strongest existing typographic decision.

**Scale.** Keep the existing **named scale** (`packages/config/tailwind-preset.js`) and add two steps. Values below are size/line-height:

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `caption` | 12 / 16 | 400 | Timestamps, meta, helper text |
| `label` | 12 / 16 | 600 | Field labels, table headers, section eyebrows. **Letter-spacing 0.02em in LTR only; 0 under `:lang(ar)`** |
| `body-sm` | 13 / 20 | 400 | Dense table cells, secondary lists |
| `body` | 14 / 22 | 400 | **Default UI text** (agent app) |
| `body-lg` **NEW** | 16 / 26 | 400 | Reading: KB articles, portal conversation, portal body |
| `subhead` | 16 / 24 | 600 | Section titles (SectionCard / inspector sections) |
| `heading` | 18 / 26 | 600 | Panel and dialog titles |
| `title` | 24 / 32 | 600 | Page `h1` |
| `display` **NEW** | 30 / 36 | 600 | KPI numbers (with `tabular-nums`) |

**Rules:**
- **No raw sizes in screens.** Raw `text-xs`/`sm`/`base`/`lg`/`2xl` and arbitrary `text-[22px]` are replaced by the named scale over the redesign (guarded in Phase 7).
- **Arabic:** body line-heights get a `:lang(ar)` bump (~+0.1); never `uppercase` or `tracking-*` on text that may be Arabic (`VL-11`). `uppercase tracking-wide` is removed from `TableHead`, the mobile cell label, `StatTile` and the customer context panel.
- **`tabular-nums`** for tables, SLA timers, KPIs, pagination and counts.
- Numeral system for Arabic is an approval item (§12). Current behaviour (`Intl` with `ar`, i.e. Arabic-Indic digits) is preserved unless changed.

### 2.7 Spacing
Keep the semantic spacing tokens (`tight` .25, `inline` .5, `stack` .75, `surface` 1, `shell` 2, `field-x`, `field-y`) and add:
- `section` **NEW** = 1.5rem: gap between page sections.
- `page-x` / `page-y` **NEW**, responsive: 1rem below `sm`, 1.5rem at `sm`, 2rem at `lg`. This replaces `p-6` on `<main>` in both shells (`RS-04`).

Numeric `gap-N`/`p-N` remain legal inside primitives. Screens should prefer tokens. This is a direction, not a big-bang sweep.

### 2.8 Radius

| Token | Value | Use |
|---|---|---|
| `rounded-control` **NEW** | 8px | Buttons, inputs, selects, segmented controls |
| `rounded-surface` **CHG** (.375rem → 12px) | 12px | Cards, panels, dialogs, sheets, popovers |
| `rounded-inner` **CHG** (.125rem → 6px) | 6px | Nested items: menu items, chips, list rows inside a surface, the logo plate |
| `rounded-pill` | 9999px | Badges, avatars, toggles |

Every new scale must be **registered in `packages/ui/src/lib/cn.ts`** (tailwind-merge). That is Story 172's precedent; forgetting it silently breaks class overrides.

### 2.9 Elevation

| Token | Light | Dark | Use |
|---|---|---|---|
| `shadow-resting` | `0 1px 2px rgb(15 23 42 / .05)` | `0 1px 2px rgb(0 0 0 / .4)` | Cards (with `rule` border) |
| `shadow-raised` **NEW** | `0 4px 12px -2px rgb(15 23 42 / .08), 0 2px 4px -2px rgb(15 23 42 / .06)` | `0 4px 12px -2px rgb(0 0 0 / .5)` | Menus, popovers, sticky headers/composer |
| `shadow-overlay` | `0 16px 40px -8px rgb(15 23 42 / .18)` | `0 16px 40px -8px rgb(0 0 0 / .6)` | Dialogs, sheets, toasts |

In dark mode, raised and overlay elements also switch to `surface-raised`.

### 2.10 Density

**Comfortable by default:**
- **Control height:** 40px for `md` (the new default; today `h-9` = 36px), 32px for `sm`, 44px for `lg`.
- **Card padding:** 20–24px.
- **Section gap:** `section` (1.5rem).
- **Body:** 14/22. The portal uses `body-lg` for reading surfaces.

**Data-dense zones get tighter *internal* spacing** while keeping the comfortable page chrome. These zones are ticket, customer and admin tables, reports, audit log, and the timeline meta. `Table` gets `density="comfortable" | "compact"`:
- comfortable: rows ≈ 48px, `px-4 py-3`
- compact: rows ≈ 40px, `px-3 py-2`, which is today's value

Data-heavy lists use `compact`; settings-style tables use `comfortable`.

**Minimum target size:** 24×24 CSS px (WCAG 2.2 AA). Primary touch targets below `sm` are ≥ 40px.

There is **no user-facing density toggle**: it is not requested and would add state.

### 2.11 Iconography
- **Library:** lucide only, through `packages/ui/src/lib/icons.ts`, which keeps its semantic naming. The three internal bypasses (`checkbox.tsx`, `dialog.tsx`, `select.tsx`) are routed through it.
- **Sizes:**
  - 16px inline and in controls
  - 20px navigation and section headers
  - 24px in empty states (inside a 40px tinted circle)
- **Stroke:** 1.75 at 20px and above; 2 at 16px.
- **Icons accompany text.** Icon-only controls always carry an accessible name and a tooltip.
- **Directional icons flip in RTL:** back, next, chevrons, send, reply, external-arrow. Non-directional icons never flip: clock, check, search, paperclip, lock. The `&larr;` entity back links are replaced by `BackLink` (RD-1.12).
- **Where icons are added** (`VL-06`): nav items (already), buttons where they aid recognition (New, Send, Attach, Assign), status, priority and SLA indicators, empty states, timeline events and channel markers.

### 2.12 Motion

| Token | Value | Use |
|---|---|---|
| `duration-fast` | 120ms | Hover, press, colour transitions |
| `duration-base` | 180ms | Menus, popovers, toasts in |
| `duration-slow` | 240ms | Dialogs, sheets |
| Easing (standard) | `cubic-bezier(.2,0,0,1)` | |
| Exit | ~0.75× the enter duration | |

- Keyframes are defined in the shared preset; **no new dependency** (no `tailwindcss-animate`).
- Sheets slide from the **inline-end** edge and mirror in RTL.
- All motion sits behind `motion-safe:` or a global `prefers-reduced-motion` override. This includes `Skeleton`'s pulse, which ignores reduced motion today (`A11Y-14`).
- Motion never carries meaning on its own.

### 2.13 Branch branding: a controlled model

**Inputs** (unchanged schema: `apps/api/prisma/schema.prisma` branding model, `#rrggbb` validated by `update-branding.dto.ts`): `appName`, `logoUrl`, `primaryColor`, `secondaryColor`, `navigationLayout`.

**Tier 1 — Identity (always applied).**
- `logoUrl` and `appName`.
- `--brand` (the raw `primaryColor`) on **decorative brand surfaces only**:
  - the header brand stripe/edge
  - the active-nav indicator bar (state is also carried by `aria-current`, weight and background)
  - the login and portal-home brand panel
  - avatar fallback ring for the branch
- `secondaryColor` is used only as a gradient partner on those same decorative panels. It is **never** used for text.

**Tier 2 — Interactive accent (applied only when gates pass).** The core `accent` family (buttons, links, selected states, `accent-surface`) is replaced by values *derived from* `primaryColor`. The derivation is a pure, unit-tested function, `deriveBrandTokens(hex)`, in `packages/ui/src/lib/brand.ts`: domain-free colour maths with no new dependency.
- **Light:** shift OKLCH lightness downward (hue kept, chroma clamped) until white text reaches **≥ 4.5:1** and the colour reaches **≥ 3:1** against `surface`.
- **Dark:** shift lightness upward until it reaches **≥ 4.5:1** against dark `surface` (it doubles as link text). Then pick `#0F172A` or `#FFFFFF` as foreground, whichever passes 4.5.
- Derive `hover`, `active` and `surface` steps from the result.

Tier 2 is **rejected**, falling back to the core indigo while Tier 1 still applies, if any gate fails:
- **(a) Recognisability:** the lightness shift needed exceeds ~0.25 OKLCH L. Typically yellows and very light colours fail this.
- **(b) Not neutral:** chroma < ~0.04. Greys and blacks would look like disabled or neutral UI.
- **(c) Not alarm:** the hue sits within ~20° of the danger red at high chroma. A red primary button would read as destructive.

**Never overridden by branding:** neutrals (`surface*`, `ink*`, `rule*`), `focus`, all semantic families, status, priority, SLA tones, chart semantic colours.

**Delivery:**
- The derived values are emitted as CSS variables (`--brand-accent`, `--brand-dark-accent`, …) on the shell root.
- The token blocks read `--accent: var(--brand-accent, <core>)`, so an unset brand falls back to core with no branching code.
- **Web:** the branding already arrives server-side (`initialBranding`, `web/app/[locale]/(agent)/layout.tsx`), so there is no flash.
- **Portal:** branding is fetched client-side today and flashes in (`PT-02`). RD-5.1 investigates whether the existing authenticated cookie permits a server-side fetch. If not, the flash is minimised (reserved logo box, fade).
- **Login screens** stay unbranded. `/portal/branding` requires auth, and changing that is an API decision (§10).

**Admin feedback:** the branding screen shows a live light/dark preview and a plain-language verdict: "Your colour is used for buttons" or "Your colour is used for brand accents only, because it would not be readable on buttons" (RD-1.7).

---

## 3. Design Principles

1. **Conversation first.** On the ticket workspace, the conversation and the composer are the page. Everything else is context arranged around them.
2. **The header owns state and action.** Every entity page (ticket, customer, article, user) starts with an identity header that shows current state and the primary actions. State is never only inside a form control.
3. **Hierarchy over decoration.** Use type, spacing and alignment before borders and boxes. Cards are for discrete objects, not for every section.
4. **Meaning is never colour-only.** Status, priority, SLA and validation always combine a label, an icon and a tone, and stay correct in dark mode and under branding.
5. **One pattern per job.** One list toolbar, one page header, one state component, one status badge, one message thread, shared across both apps. A local copy needs a written reason.
6. **Comfortable shell, efficient data.** Spacious chrome and reading surfaces; tighter tables where agents scan.
7. **Progressive disclosure, not hidden content.** Collapse secondary context (inspector sections, AI output, long history) behind clear headings. Never remove a capability to make a screen look simpler.
8. **Parity by construction.** Arabic/English, RTL/LTR, light/dark and every branch brand are produced by the same tokens and logical properties. None is a special case added afterwards.
9. **Accessible by default.** Live regions for anything that changes on its own, real names for every control, visible focus everywhere, headings that outline the page.
10. **Presentation, not behaviour.** The redesign changes how things look and are arranged. Any interaction change must be small, justified by a recon finding, and listed in its Story.

---

## 4. Redesign Architecture

### 4.1 Layers

```
packages/config   tokens (CSS vars, light + dark + brand fallbacks) · Tailwind preset · motion keyframes
      │
packages/ui       generic primitives (domain-free; strings via props) · lib: icons, cn, brand, overlay, menu
      │
@crm/shared       pure presentation constants shared by both apps (ticket status/priority → tone + icon key)
      │
apps/web/src/components/**     CRM patterns for agents (ticket workspace, SLA, inspector…)
apps/portal/src/components/**  CRM patterns for customers
```

**Rules:**
- **`packages/ui` stays domain-free.** No i18n dependency, no ticket/customer types, every string passed as a prop. Recon confirmed this invariant holds today (`recon.md` §7); keeping it is what lets both apps share it.
- **Domain patterns stay in the apps,** unless both apps need the *same* rendering and the domain part can be expressed as props. When that is the case, the generic shell goes to `packages/ui` and the domain mapping stays in the app.
- **No new workspace package.** Creating a `packages/crm-ui` would be an architectural decision this track does not need. The generic-shell-plus-app-mapping split covers every duplicate found by recon.
- **Ticket presentation constants go in `@crm/shared`** (`packages/shared/src/ticket-presentation.ts`): pure data with no React. That package's stated purpose is "constants used by both frontend apps", and both apps already depend on it. This removes the deliberate web/portal duplication of `lib/ticket-badges.ts` and the hand mirror in `report-charts.tsx`.
- **New primitives arrive just in time,** in the Story of their first consumer. They are never added speculatively (`CLAUDE.md` §2: no abstractions for unplanned work).

### 4.2 Generic UI primitives (`packages/ui`)

| Primitive | Status | Redesign action | First Story |
|---|---|---|---|
| Button | exists | Add `secondary`, `link`, `size="icon"`; `rounded-control`; 40px default; tokenised danger foreground | RD-1.8 |
| Badge | exists | `tone` incl. `info`/`progress`; leading icon/dot slot; `size` sm/md; `rounded-pill` | RD-1.8 |
| Alert | exists | Add `warning`/`info`; icon + title slots | RD-1.8 |
| Input, Textarea | exists | Sizes; `rule-control`; `aria-invalid` styling; leading/trailing slot (search, clear) | RD-1.9 |
| Select | exists | Sizes; `rule-control`; raised menu | RD-1.9 |
| Checkbox, Label | exists | Token radius; control border | RD-1.9 |
| FormField | exists | Visual refresh (required marker, hint/error styles) | RD-1.9 |
| Card, SectionCard | exists | New radius/elevation; `SectionCard` gains a `collapsible` option (used by the inspector) | RD-1.10 / RD-3.3 |
| Dialog, AlertDialog, ConfirmDialog | exists | Sizes sm–xl; motion; on-scale title; fold the web `ConfirmDialog` wrapper | RD-1.10 |
| Popover, Tooltip, DropdownMenu | exists | `surface-raised`, `shadow-raised`; fix the `ps-8` indent on items without a check mark | RD-1.10 |
| Skeleton family | exists | Reduced motion; page-shaped recipes (list, two-column detail, form) | RD-1.10 / RD-3.12 |
| Table | exists | `density`; row hover/selected; `TableSortHead` primitive; no uppercase | RD-1.11 |
| Pagination | exists | Visual refresh only | RD-1.11 |
| PageHeader | exists | Slots: `back`, `meta`, `actions`, `tabs` | RD-2.3 |
| EmptyState, QueryStateCard, LoadingStatus, FetchingIndicator | exists | Visual refresh (icon circle, `body` text) | RD-1.10 |
| **ErrorState** | NEW | Page and section error: heading, message, retry, back; used by detail errors and error boundaries | RD-2.5 |
| Tabs | exists | Visual refresh; used for the mobile ticket segmented view | RD-3.12 |
| Toast (replaces `SuccessToaster`) | exists → v2 | success/info/warning/error; 320px-safe; region always mounted | RD-1.13 |
| **LocaleSwitcher**, **ThemeSwitcher** | NEW | Props-driven; replace 4 native `<select>`s | RD-1.5 |
| **Avatar** (+ presence dot) | NEW | Image/initials; `rounded-pill`; presence uses icon + sr text | RD-1.12 |
| **Separator**, **Kbd**, **DescriptionList** | NEW | Display primitives | RD-1.12 |
| **BackLink** | NEW | Replaces 5 `&larr;` links; flips in RTL | RD-1.12 |
| **Combobox** (searchable select / mention list) | NEW | Radix Popover + listbox ARIA (`aria-activedescendant`, arrow keys) | RD-3.4 |
| **MessageThread / MessageBubble** | NEW | Generic chat rendering: `role="log"`, day separators, sender label, alignment, delivery-state slot | RD-3.5 |
| **Composer** shell | NEW | Generic textarea + toolbar + send; IME-safe Enter; keeps focus | RD-3.7 |
| **FileDropzone** | NEW | Labelled file input + drop area; localized text | RD-3.8 |
| **ListToolbar** | NEW | Search (Enter submits, clear) + filters + count + clear-all + mobile sort | RD-4.1 |
| **StatCard** | NEW | KPI with `display` number, label, optional delta/link | RD-4.6 |
| **Switch** | NEW | Preference toggles | RD-5.7 |
| **Sheet** | NEW | Side panel from inline-end; admin edit pattern; inspector on tablet | RD-6.1 |

### 4.3 CRM-specific patterns (app/domain level)

| Pattern | Location | Built on | Story |
|---|---|---|---|
| Ticket status/priority presentation map | `packages/shared/src/ticket-presentation.ts` (data only) | — | RD-1.14 |
| `TicketStatusBadge`, `TicketPriorityBadge` | `apps/web/src/components/tickets/`, `apps/portal/src/components/tickets/` (thin, each uses its own i18n) | Badge + shared map | RD-1.14 |
| `SlaIndicator` (+ at-risk tier, which-target label, localized duration) | `apps/web/src/components/tickets/` (the portal shows no SLA) | Badge, icons, `web/lib/sla.ts` | RD-1.15 |
| `ActiveBadge` (active/inactive/verified) | `apps/web/src/components/` (11 sites) | Badge | RD-6.6 |
| Ticket header (identity, state, actions) | web `components/tickets/` | PageHeader slots, badges, SlaIndicator, Avatar | RD-3.1, RD-3.2 |
| Ticket inspector (properties, customer, SLA, escalations, CSAT) | web | SectionCard collapsible, DescriptionList, Combobox | RD-3.3, RD-3.4, RD-3.11 |
| Unified timeline (messages + notes + events) | web | MessageThread + event rows | RD-3.5, RD-3.6 |
| Ticket composer (reply/note modes, tools) | web | Composer, Combobox, FileDropzone | RD-3.7, RD-3.8 |
| AI assist panel | web | SectionCard, Alert, live region | RD-3.9 |
| KB references | web | DescriptionList-style rows, Combobox | RD-3.10 |
| Customer context / customer summary | web | Avatar, DescriptionList, badges | RD-3.11, RD-4.5 |
| Ticket queue views | web | ListToolbar, Table | RD-4.2 |
| Portal ticket conversation | portal | MessageThread + Composer (same primitives as web) | RD-5.4 |
| Portal assistant chat | portal | MessageThread + Composer | RD-5.6 |
| Date/time formatting (`formatDateTime`, relative time) | one helper per app over `Intl` (strings and locale are app concerns) | — | RD-1.17 |

---

## 5. Redesign Phases

**Sequence change versus the suggested outline:** a short **App Shell** phase (Phase 2) is inserted *before* the Ticket Workspace. The workspace's sticky header and composer, its mobile layout and its page padding all depend on the shell's header height, its mobile navigation and the `page-x` tokens. Building the workspace first would mean redoing its sticky offsets and breakpoints. The shell phase is small: 6 Stories. The suggested Phases 3–6 become 4–7.

| Phase | Name | Stories |
|---|---|---|
| 0 | Design Direction & Baseline | 2 |
| 1 | Design Foundation | 17 |
| 2 | App Shell & Page Frame | 6 |
| 3 | Ticket Workspace (centrepiece) | 14 |
| 4 | Agent Workspace | 8 |
| 5 | Customer Portal | 7 |
| 6 | Admin & Reports | 9 |
| 7 | Cross-Product Polish & Closeout | 8 |
| | **Total** | **71** |

### Phase 0 — Design Direction & Baseline
- **Objective:** freeze the direction in this document as a permanent architecture doc, and capture "before" evidence.
- **Scope:** documentation and screenshots only.
- **Likely files:** `docs/architecture/13-design-language.md` (new), `docs/architecture/10-i18n-and-rtl.md` (the `RTL-06` drift fix).
- **UX outcome:** none visible. It gives every later Story a reference and a baseline.
- **Risk:** Low.
- **Dependencies:** approval of §12 items.
- **Verification:** doc review; baseline set complete.
- **Out of scope:** any token or code change.

### Phase 1 — Design Foundation
- **Objective:** light and dark tokens, the branding model, restyled primitives, a semantic status layer, and the i18n leak fixes. After this phase every screen re-skins with almost no screen-level edits.
- **Scope:** `packages/config`, `packages/ui`, `packages/shared`, both apps' `tailwind.config.ts`, `[locale]/layout.tsx`, header selects, badge/SLA call sites, i18n messages.
- **Likely files:** `tailwind-tokens.css`, `tailwind-preset.js`, `ui/lib/{cn,icons,brand}.ts`, `ui/components/*`, `apps/*/tailwind.config.ts`, `apps/*/src/app/[locale]/layout.tsx`, `apps/*/src/lib/ticket-badges.ts` → shared, `web/lib/sla.ts`, `messages/{en,ar}.json`.
- **UX outcome:** an indigo identity, working dark mode, branded branches, readable controls, one status language, no raw enums.
- **Risk:** Medium. Global visual changes and new control heights can reflow the 320px header (Story 173's measurements).
- **Dependencies:** Phase 0.
- **Verification:** unit specs per primitive; the guard specs; full app test suites; screenshot matrix on baseline screens.
- **Out of scope:** layout re-composition of any page.

### Phase 2 — App Shell & Page Frame
- **Objective:** a modern frame around every page. A header with a user menu, restyled navigation, a consistent page header, and error boundaries that keep the shell.
- **Scope:** `web/components/workspace/*`, `portal/components/portal/portal-header.tsx`, `PageHeader`, error/not-found files, the six pages where PageHeader is misplaced.
- **UX outcome:** recognisable product chrome, user and preference controls in one place, no dead-end errors, no double `h1`.
- **Risk:** Medium. The header is on every page, and e2e specs navigate through it.
- **Dependencies:** RD-1.5, RD-1.6, RD-1.8–1.12.
- **Verification:** header/nav specs, `admin-navigation-layout.spec.ts` (Playwright), keyboard walk, 320px check.
- **Out of scope:** nav IA or permission changes (§12), global search, command palette.

### Phase 3 — Ticket Workspace (centrepiece)
- **Objective:** implement §6's Phase 3 information architecture in bounded Stories. Every existing section and action must survive, as Story 156's guard approach required.
- **Scope:** `web/components/tickets/*` (detail view, chat card, AI card, KB references card, customer context panel), `web/components/attachments/attachments-card.tsx`, new generic primitives (Combobox, MessageThread, Composer, FileDropzone).
- **UX outcome:**
  - a sticky identity header showing state
  - one timeline
  - one composer with Reply/Note modes
  - a sticky collapsible inspector
  - AI insertion
  - accessible live conversation
  - a usable phone layout
- **Risk:** **High.** It is the most-used screen, and `agent-resolves-ticket.spec.ts` and `agent-customer-live-chat.spec.ts` drive it.
- **Dependencies:** Phases 1–2.
- **Verification:** section-survival guard spec; the existing ticket specs; both Playwright ticket specs; screen-reader smoke test for live regions; 320/768/1280 × en/ar × light/dark.
- **Out of scope:** merge/split, collision backend, message-level attachments, AI persistence, new API fields.

### Phase 4 — Agent Workspace
- **Objective:** apply the system to everyday agent screens: queues, customers, dashboard, KB, notifications.
- **Scope:** `ticket-list-view.tsx`, `customer-list-view.tsx`, `customer-detail-view.tsx`, `dashboard/*`, `knowledge-base/*`, `notifications/*`.
- **UX outcome:** efficient triage, customer profiles, a scannable dashboard, a KB read mode, a notifications inbox.
- **Risk:** Medium.
- **Dependencies:** Phases 1–2. RD-4.3 also needs RD-1.14/1.15.
- **Verification:** per-view specs; URL filter specs; screenshot matrix.
- **Out of scope:** new list APIs, saved-view backend, a different landing route (§12).

### Phase 5 — Customer Portal
- **Objective:** customer-grade polish using the same system and the same conversation primitives as the agent app.
- **Scope:** `apps/portal/src/**` views and the `(customer)` layout.
- **UX outcome:** a width-capped, branded, readable portal with clear calls to action, an accessible chat, and no dead ends.
- **Risk:** Medium. `customer-submits-ticket.spec.ts` and `kb-publish-portal-visibility.spec.ts` drive it.
- **Dependencies:** Phases 1–2; RD-3.5 and RD-3.7 for the shared thread and composer.
- **Verification:** portal specs; both portal Playwright specs; screenshot matrix.
- **Out of scope:** forgot-password, a ticket-description field, chat session resume, pre-auth branding. All need the API (§10).

### Phase 6 — Admin & Reports
- **Objective:** replace in-cell editing with list + Sheet/Dialog editors; consistent admin pages; reports clean-up.
- **Scope:** `users/*`, `sla-policies/*`, `roles/*`, `branches/*`, `ticket-categories/*`, `kb-categories/*`, `settings/*`, `business-hours/*`, `admin/*`, system screens, `audit-logs/*`, `reporting/*`, the create-form pages.
- **UX outcome:** calm, readable admin tables, focused editors, and reports with a single error state.
- **Risk:** Medium. Many forms, and every mutation must be preserved.
- **Dependencies:** Phases 1–2; RD-6.1 (Sheet) first.
- **Verification:** per-view specs, with every pre-existing mutation test kept green; Playwright admin-navigation spec.
- **Out of scope:** permission-model changes, new admin features.

### Phase 7 — Cross-Product Polish & Closeout
- **Objective:** sweep the remaining primitive adoption, run the parity audits (responsive, RTL, dark, branding, accessibility), and finish the design-system docs.
- **Scope:** everything left over, plus guard specs.
- **UX outcome:** the Definition of Done (§11) is measurably met.
- **Risk:** Low–Medium.
- **Dependencies:** Phases 1–6.
- **Verification:** the full §9 matrix on every route.
- **Out of scope:** new features; non-visual infrastructure duplicates (§10).

---

## 6. Story Breakdown

Each Story names its objective, scope, likely files, dependencies, acceptance criteria (AC), verification (V) and non-goals (NG). **Every Story's verification implicitly includes** §9's baseline:
- the relevant `pnpm --filter … test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `git status --short` (only the Story's files are touched)

### Phase 0 — Design Direction & Baseline

**RD-0.1 Design language architecture doc**
- **Objective:** make §2–§4 a permanent reference.
- **Scope:** new `docs/architecture/13-design-language.md`, condensed from §2–§4 with the approved §12 decisions applied. Fix `10-i18n-and-rtl.md:14`, which wrongly says directional icons flip via a `[dir=rtl]` rule (code uses `rtl:rotate-180`).
- **Dependencies:** §12 approvals.
- **AC:**
  - every token family, the status vocabulary, the branding tiers and the primitive/pattern split are documented
  - `README.md`'s frontend section links to it
- **V:** doc review; markdown lint passes if configured.
- **NG:** no code or token changes.

**RD-0.2 Visual baseline capture**
- **Objective:** "before" evidence for the screenshot matrix.
- **Scope:** capture 14 screens × {320, 768, 1280} × {en, ar}:
  - web: login, dashboard, ticket list, ticket detail, customer detail, KB article, users, reports, notifications
  - portal: home, tickets, ticket detail, KB article, chat

  Use an ad-hoc Playwright script against the local stack, following the existing `apps/e2e/browser-check-temp.mjs` precedent. Store the output **outside the repo** (or in a git-ignored folder) and index it in the completion report.
- **Dependencies:** none.
- **AC:** a complete, named screenshot set; the capture script is reproducible (kept in scratch, not committed).
- **V:** manual review.
- **NG:** no committed binaries; no new test infrastructure in CI.

### Phase 1 — Design Foundation

**RD-1.1 Colour tokens v2 (light)**
- **Objective:** apply §2.2 light values.
- **Scope:**
  - `tailwind-tokens.css`: change `accent*` → indigo, `ink-subtle`, `focus`, `warning-solid`, `danger-solid-hover`, `info` → sky
  - add `surface-raised`, `rule-control`, `accent-active`, the `progress` family
  - remove the unmapped shadcn aliases
  - `tailwind-preset.js` mappings
- **Dependencies:** RD-0.1.
- **AC:**
  - all §2.2 light pairs meet their stated ratios (computed in a new `packages/config` or `packages/ui` spec using a tested luminance helper)
  - 0 references to removed aliases
  - `tailwind-content.spec.ts` (both apps) still passes
- **V:** unit specs; build; screenshot spot-check of 4 baseline screens.
- **NG:** no dark values, no primitive restyle, no screen edits.

**RD-1.2 Shape, elevation, motion and type tokens**
- **Objective:** §2.6–§2.9 and §2.12 tokens.
- **Scope:**
  - radius `control` / `surface` / `inner` values
  - `shadow-raised`, revised `resting` / `overlay`
  - `section`, `page-x`, `page-y` spacing
  - `body-lg`, `display`, revised `label` letter-spacing with a `:lang(ar)` reset
  - motion keyframes and durations in the preset
  - register every new scale in `ui/lib/cn.ts` (+ `cn.spec.ts`)
- **Dependencies:** RD-1.1.
- **AC:** `cn("rounded-control rounded-surface")` and similar merges resolve correctly in specs; `:lang(ar)` resets letter-spacing.
- **V:** cn specs; build.
- **NG:** no primitive adopts them yet.

**RD-1.3 Remove raw palette leaks and add guard specs**
- **Objective:** make colour token-only before dark mode lands.
- **Scope:**
  - replace raw-palette uses with semantic tokens at the 8 sites (`VL-10`). These include the emerald text classes, which also fixes `A11Y-12`.
  - replace `text-white` in `button.tsx`
  - move `text-danger-solid`-as-text uses to `danger-foreground`
  - new guard spec per app plus `packages/ui`: no `(bg|text|border|ring)-(slate|gray|zinc|neutral|red|amber|emerald|…)-\d` classes, no physical-direction utilities, `dark:` only inside `packages/ui`
- **Dependencies:** RD-1.1.
- **AC:** the guard specs pass and fail when a violation is introduced (asserted with a fixture).
- **V:** app and ui test suites.
- **NG:** no layout changes.

**RD-1.4 Dark-mode token layer and theme resolution**
- **Objective:** §2.5 dark values plus the mechanism.
- **Scope:**
  - dark blocks in `tailwind-tokens.css` (`[data-theme="dark"]` and the `prefers-color-scheme` fallback) plus `color-scheme`
  - `darkMode` variant config in both `tailwind.config.ts`
  - read the `crm-theme` cookie in both `[locale]/layout.tsx` and the root not-found layout to set `data-theme`
  - dark logo plate in both headers
- **Dependencies:** RD-1.1, RD-1.2, RD-1.3.
- **AC:**
  - with the OS in dark mode and no cookie, every baseline screen renders dark with no flash
  - the cookie forces light or dark
  - all §2.2 dark pairs meet their stated ratios (spec)
  - native controls follow the theme
- **V:** specs for cookie parsing and the layout attribute; manual light/dark screenshots of the baseline set.
- **NG:** no toggle UI (RD-1.5); no DB persistence.

**RD-1.5 Preference controls: `LocaleSwitcher` and `ThemeSwitcher`**
- **Objective:** one accessible control for each preference.
- **Scope:**
  - new `ui/components/locale-switcher.tsx` and `theme-switcher.tsx` (props-driven labels; `focus-ring`; control height tokens)
  - replace the 4 native locale `<select>`s (`web/login/page.tsx`, `workspace-header.tsx`, `portal/login/page.tsx`, `portal-header.tsx`)
  - add `ThemeSwitcher` beside each one; it writes the `crm-theme` cookie and updates `data-theme` without a reload
  - en/ar messages
- **Dependencies:** RD-1.4.
- **AC:**
  - locale switching behaves exactly as before (same `buildLocalePath`, same cookie)
  - the theme switch applies instantly and persists
  - both controls are labelled and keyboard-operable
- **V:** component specs; header/login specs updated only for the new control's markup; 320px header check (the Story 173 constraint).
- **NG:** no user menu yet (RD-2.1); the branch switcher is unchanged.

**RD-1.6 Branch branding token model**
- **Objective:** §2.13 Tier 1 and Tier 2.
- **Scope:**
  - `ui/lib/brand.ts` with `deriveBrandTokens(hex)` (OKLCH maths, gates, light and dark outputs) plus specs over representative colours: red, yellow, sky, green, black, indigo, teal
  - the web shell (`workspace-shell.tsx` / `workspace-header.tsx`) and the portal header emit the brand CSS variables, replacing the ad-hoc `--brand-primary` border
  - `secondaryColor` is applied to the decorative brand panel only
- **Dependencies:** RD-1.4.
- **AC:**
  - every derived accent meets the §2.13 ratios in both modes
  - gate failures fall back to core indigo while Tier 1 still applies
  - semantic, focus and neutral tokens are provably untouched (spec)
  - with no branding, the output is identical to core
- **V:** unit specs; manual check with 4 sample brands × light/dark.
- **NG:** no admin UI change (RD-1.7); no pre-auth branding.

**RD-1.7 Branding admin preview and verdict**
- **Objective:** admins see the effect before saving.
- **Scope:** `web/components/admin/branding-view.tsx`:
  - a colour swatch beside each hex input
  - a live mini-preview (header, primary button, link, status badge) in light and dark
  - the plain-language Tier 2 verdict
  - `focus-ring` on the layout radio cards (`A11Y-08`)
- **Dependencies:** RD-1.6.
- **AC:** the preview matches the shipped tokens (same function); the verdict text is localized; existing save behaviour is unchanged.
- **V:** branding-view specs; manual check.
- **NG:** no new branding fields; no colour-picker dependency.

**RD-1.8 Primitives A: Button, Badge, Alert**
- **Scope:**
  - Button: `secondary`, `link`, `size="icon"` (requires `aria-label` via its types/docs), `rounded-control`, 40/32/44px heights, the `accent-active` state
  - Badge: tones including `info`/`progress`, icon/dot slot, sizes, `rounded-pill`
  - Alert: `warning`/`info` plus icon and title slots
- **Dependencies:** RD-1.2.
- **AC:**
  - existing variant names keep working (no call-site edits required)
  - new variants have specs
  - `isLoading` keeps the accessible name (the Story 169 test stays green)
- **V:** ui specs; screenshots of the dashboard and ticket list.
- **NG:** no call-site migrations beyond what compiles.

**RD-1.9 Primitives B: form controls**
- **Scope:**
  - Input, Textarea and Select: sizes, `rule-control`, `aria-invalid` styling, leading/trailing slots
  - Checkbox: radius token, control border
  - FormField: required marker, hint and error visuals
  - route Checkbox/Select icons through `icons.ts`
- **Dependencies:** RD-1.2.
- **AC:**
  - `aria-invalid="true"` visibly changes the border to `danger-solid` plus an icon in the error text
  - FormField's ARIA tests stay green
- **V:** ui specs.
- **NG:** no FormField adoption sweep (RD-7.1).

**RD-1.10 Primitives C: surfaces and overlays**
- **Scope:**
  - Card and SectionCard: new radius and elevation
  - Dialog: sizes sm–xl, motion, `heading` title
  - AlertDialog and ConfirmDialog: same treatment; fold `web/components/confirm-dialog.tsx` into the primitive, or justify keeping it
  - Popover, Tooltip, DropdownMenu: raised surface and shadow; fix the item indent
  - Skeleton: `motion-reduce`
  - EmptyState and QueryStateCard: visual refresh
- **Dependencies:** RD-1.2.
- **AC:**
  - the ConfirmDialog pending and focus-return specs stay green
  - dialogs centre correctly in RTL (`overlay.ts`)
  - reduced motion disables the pulse and animations
- **V:** ui specs; manual RTL dialog check.
- **NG:** Sheet (RD-6.1).

**RD-1.11 Table v2**
- **Scope:**
  - `density` prop
  - row hover and selected states
  - `TableSortHead` primitive (button + `aria-sort` + SortIndicator)
  - remove `uppercase tracking-wide` from the header and mobile label
  - Pagination visual refresh
  - adopt `TableSortHead` at the hand-rolled sort buttons (`ticket-list-view.tsx:334,346` and the customer list)
- **Dependencies:** RD-1.2.
- **AC:**
  - `table-mobile-labels.spec.ts` passes unchanged
  - sorting behaviour and `aria-sort` are unchanged
  - compact density reproduces today's padding
- **V:** ui and web specs.
- **NG:** mobile sort control (RD-4.1).

**RD-1.12 Display primitives: Avatar, Separator, Kbd, DescriptionList, BackLink**
- **Scope:** the new primitives, plus adopting `BackLink` at the 5 back-link sites (`recon.md` §7.4).
- **Dependencies:** RD-1.2.
- **AC:**
  - Avatar falls back to initials (correct for Arabic names) and its presence is exposed as text
  - BackLink flips in RTL and has `focus-ring`
- **V:** ui specs; the affected view specs.
- **NG:** Avatar adoption elsewhere happens in later Stories.

**RD-1.13 Toast v2**
- **Scope:**
  - `SuccessToaster` → `Toast` with success/info/warning/error tones and a 320px-safe position (`inset-x-4 sm:inset-x-auto sm:end-4`)
  - live region always mounted
  - both apps' `notification-toaster.tsx` layouts aligned to it (`RS-01`, `A11Y-10`)
- **Dependencies:** RD-1.8.
- **AC:**
  - no overflow at 320px (manual check)
  - the first toast is announced (the region exists before the first item; spec)
  - `showSuccessToast` callers are unchanged
- **V:** ui and app toaster specs.
- **NG:** the toast message content (RD-1.16 fixes the raw status text).

**RD-1.14 Ticket status and priority presentation**
- **Scope:**
  - `packages/shared/src/ticket-presentation.ts` (tone + icon key per status and priority)
  - `TicketStatusBadge` and `TicketPriorityBadge` in both apps
  - replace `ticketStatusBadgeVariant` / `ticketPriorityBadgeVariant` call sites (8 status + 6 priority), `report-charts.tsx` `ticketStatusBarColor`, the portal `lib/ticket-badges.ts`, and the SLA-policy priority badge (`sla-policy-list-view.tsx:191`)
- **Dependencies:** RD-1.8.
- **AC:**
  - no visual collision (OPEN ≠ HIGH; IN_PROGRESS ≠ LOW/MEDIUM)
  - every badge shows icon + localized label
  - both app maps deleted
- **V:** specs over all 8 enum values in en/ar; `ticket-enum-messages.spec.ts` green.
- **NG:** no layout changes to the views.

**RD-1.15 `SlaIndicator`**
- **Scope:**
  - one web component replacing `SlaCell` (`ticket-list-view.tsx:96`), `SlaPresentation` (`dashboard-view.tsx:84`) and the inline detail rendering
  - extend `sla.ts` to report *which* target governs and the at-risk tier (threshold per §12)
  - localize `formatRemaining` through the i18n unit keys
- **Dependencies:** RD-1.8, the §12 threshold decision.
- **AC:**
  - all four existing kinds render the same information as today plus the target label
  - at-risk appears per the threshold
  - Arabic output contains no Latin `h`/`m`
- **V:** `sla.ts` specs (boundary cases), component specs.
- **NG:** no live ticking countdown; no API change.

**RD-1.16 i18n leak fixes**
- **Scope:**
  - `renderLabel` for the status and priority FilterSelects (`ticket-list-view.tsx:244-259`, `TK-01`)
  - localized ticket-history `eventType` labels (web `ticket-detail-view.tsx:822`, portal `ticket-detail-view.tsx:181`), with a fallback to a generic label for unknown types
  - portal priority (`ticket-detail-view.tsx:145`)
  - portal toast status (`notification-toaster.tsx:116-119`)
  - extend the enum-message parity specs
- **Dependencies:** none; it can run in parallel with RD-1.1.
- **AC:** no raw enum text is visible in any of these places, in either locale; the parity specs cover every enum value.
- **V:** app specs.
- **NG:** audit-log code labels (RD-6.7).

**RD-1.17 Locale-aware date/time helper**
- **Scope:**
  - `lib/format-date.ts` per app (absolute, short, time, relative) over `Intl` with the active locale
  - adopt at the 23 web and 6 portal inline `toLocale*String` sites, including the 4 locale-less ones (`RTL-02`)
- **Dependencies:** §12 numeral decision.
- **AC:** 0 inline `toLocale*String(` calls in components (guard spec); output is unchanged for en; ar follows the decision.
- **V:** helper specs; affected view specs.
- **NG:** no timezone-model change.

### Phase 2 — App Shell & Page Frame

**RD-2.1 Agent header v2 and user menu**
- **Scope:** `workspace-header.tsx`:
  - brand block (logo or app name) and brand stripe
  - "New ticket" primary action (links to the existing `/tickets/new`)
  - notifications bell linking to `/notifications`, with the unread count from the existing store and an accessible name that includes the count (fixes `A11Y-11`)
  - user menu (Avatar plus name) containing the branch switcher, `LocaleSwitcher`, `ThemeSwitcher`, My sessions, Settings and Sign out
  - hamburger moved into the header row below `sm` (`NAV-04`)
- **Dependencies:** RD-1.5, RD-1.12.
- **AC:**
  - every current control is still reachable (branch switch, locale, sign out)
  - no horizontal overflow at 320px in en and ar with multiple memberships (Story 173's scenario)
  - focus rings everywhere
- **V:** header specs; Playwright `admin-navigation-layout.spec.ts` and `session-expiry-and-refresh.spec.ts`.
- **NG:** global search, command palette, permission-gated nav.

**RD-2.2 Navigation surfaces restyle**
- **Scope:** `workspace-navbar.tsx`, `workspace-sidebar.tsx`, `nav-items.tsx` (presentation only): 20px icons, active state (`surface-muted` + Tier 1 brand indicator + `aria-current`), group headings in `label` style without uppercase, collapsed rail.
- **Dependencies:** RD-1.6.
- **AC:** `NAV_GROUPS` order, hrefs, labels and active-route rules are unchanged (the existing nav specs pass); the rail tooltips still follow text direction.
- **V:** nav specs; Playwright admin-navigation spec; RTL screenshot.
- **NG:** IA, grouping or permission changes.

**RD-2.3 Page frame and PageHeader v2**
- **Scope:**
  - `page-x`/`page-y` padding in `workspace-shell.tsx` and the portal `(customer)/layout.tsx`
  - PageHeader slots: `back`, `meta`, `actions`, `tabs`
  - responsive actions wrapping
- **Dependencies:** RD-1.2, RD-1.12.
- **AC:** the PageHeader single-`h1` invariant holds (spec); existing props are unchanged.
- **V:** ui spec; screenshots.
- **NG:** moving PageHeader on individual pages (RD-2.4).

**RD-2.4 PageHeader placement normalization**
- **Scope:**
  - move PageHeader out of Cards (`branch-departments-view.tsx:82`, `ticket-categories-view.tsx:45`, `kb-categories-view.tsx:44`)
  - use the `actions` and `meta` slots instead of sibling wrappers (`notification-history-view.tsx:251`, `audit-log-view.tsx:125`, `sla-policy-list-view.tsx:55`)
  - pass `description` through the prop
  - single `h1` on Settings: embedded views render their own headers as `h2` when hosted (`settings-view.tsx:23`, `A11Y-04`)
- **Dependencies:** RD-2.3.
- **AC:** every agent page has exactly one `h1`, at the top of `<main>` (spec per view where one exists).
- **V:** view specs.
- **NG:** content changes.

**RD-2.5 `ErrorState` and in-shell error boundaries**
- **Scope:**
  - new `ui/components/error-state.tsx`
  - new `web/app/[locale]/(agent)/error.tsx` that renders inside the shell (`NAV-05`)
  - migrate web and portal `error.tsx` / `not-found.tsx` hand-rolled cards and the raw button
  - detail-page load errors get `h1`, back and retry: web customer detail (`:526`), web KB detail (`:130`), business hours (`:459`), branches (`:54`), portal ticket detail (`:102`), portal KB detail (`:43`) (`A11Y-03`, `VL-08`)
- **Dependencies:** RD-1.10, RD-1.12.
- **AC:**
  - no error state on these pages lacks an `h1`
  - retry calls the existing `refetch`
  - the not-found specs (`not-found-css.spec.ts`, layout specs from `3461bcf`) stay green
- **V:** app specs.
- **NG:** route-level loading skeleton redesign.

**RD-2.6 Portal header v2**
- **Scope:** `portal-header.tsx`:
  - brand block with truncation and logo cap (`PT-03`, `RS-06`)
  - an explicit "Home" nav item
  - user menu containing the language and theme switchers and sign out
  - focus rings on the home and back links
  - the unread badge label moved onto the link (`A11Y-11`)
- **Dependencies:** RD-1.5, RD-1.12.
- **AC:** no overflow at 320px in en and ar; all nav destinations unchanged.
- **V:** portal header specs; Playwright `customer-submits-ticket.spec.ts`.
- **NG:** server-side branding (RD-5.1).

### Phase 3 — Ticket Workspace

Shared constraints for all Phase 3 Stories:
- No API change.
- Every existing section, action and mutation stays available.
- A **section-survival guard spec** is introduced in RD-3.1 and extended in each Story (Story 156 precedent).
- `agent-resolves-ticket.spec.ts` and `agent-customer-live-chat.spec.ts` must pass. Where a selector changes because markup changed, the Story updates the selector and records why. Assertions are never weakened (`CLAUDE.md` §4).

**RD-3.1 Ticket header: identity and state**
- **Scope:** new `ticket-header.tsx`:
  - BackLink, ticket short id, subject (the existing inline edit kept verbatim: Escape cancels, focus restore)
  - status and priority badges, `SlaIndicator`, assignee avatar and name, channel, created/updated times (`DateTime`)
  - customer link
  - sticky below the app header at `lg`
- **Dependencies:** Phase 2, RD-1.14, RD-1.15.
- **AC:** an agent sees status, priority, SLA and assignee without scrolling at 1280px (`TW-01`); the `h1` is unchanged semantically.
- **V:** guard spec, header spec, Playwright ticket specs.
- **NG:** actions (RD-3.2).

**RD-3.2 Ticket header actions**
- **Scope:** "Assign to me", plus a status quick action (Resolve/Close or reopen) using the **existing** ticket PATCH mutation and its success toast and error Alert.
- **Dependencies:** RD-3.1.
- **AC:** each action performs exactly the same request as the equivalent inspector field; it is disabled while pending, with an accessible name.
- **V:** specs asserting the mutation payloads; Playwright `agent-resolves-ticket`.
- **NG:** prev/next (RD-3.14); new statuses.

**RD-3.3 Inspector layout**
- **Scope:**
  - side column → sticky, independently scrolling inspector
  - SectionCard `collapsible` sections, each with a heading: Properties (fixing the untitled card, `TW-07`), Customer, SLA, Escalations, CSAT
  - collapse state is client-only
  - properties shown with DescriptionList plus the existing controls
- **Dependencies:** RD-3.1, RD-1.10, RD-1.12.
- **AC:** every field and control from today is present; the heading outline is h1 → h2 sections; nothing is hidden by default above the fold.
- **V:** guard spec; detail specs.
- **NG:** control replacement (RD-3.4); timeline (RD-3.6).

**RD-3.4 Combobox primitive and assignee `UserPicker`**
- **Scope:**
  - `ui/components/combobox.tsx` (listbox ARIA, arrow keys, type-ahead, RTL via Radix)
  - an assignee picker with avatar, presence and a "Me" shortcut
  - "Unassigned" / clear options **only if the existing PATCH already accepts `null`**; this is verified in recon at Story start and otherwise dropped (`TW-08`)
- **Dependencies:** RD-3.3.
- **AC:** keyboard-only assignment works; presence is announced as text; the payload is identical to today.
- **V:** combobox specs (ARIA roles, keys); detail specs.
- **NG:** team scoping, server-side user search.

**RD-3.5 `MessageThread` v2 (web conversation)**
- **Scope:**
  - new `ui/components/message-thread.tsx` and `message-bubble.tsx`: `role="log"` + `aria-live="polite"`, day separators, date and time, sender label and avatar, delivery-state slot
  - auto-scroll only when already at the bottom, otherwise a "new messages" pill
  - adopt in `web/components/tickets/ticket-chat-card.tsx`
  - rename "Live Chat" to "Conversation" (en/ar)
- **Dependencies:** RD-1.12, RD-1.17.
- **AC:**
  - new realtime messages are announced (spec with `role="log"`)
  - multi-day threads show dates (`TW-03`)
  - agents keep their scroll position while reading history
- **V:** ui and web specs; Playwright `agent-customer-live-chat`; screen-reader smoke test.
- **NG:** message attachments, pagination.

**RD-3.6 Unified timeline**
- **Scope:**
  - interleave notes, history events (localized from RD-1.16, with the actor resolved from users already loaded) and escalations into the thread chronologically
  - internal notes tinted (`warning-subtle`) with a lock icon and an "Internal note" label
  - filter control: All / Conversation / Notes / Events
  - remove the separate Notes, History and Escalations cards, carrying their content over verbatim
- **Dependencies:** RD-3.5.
- **AC:**
  - every note, event and escalation visible today is visible in the timeline
  - notes are never visually confusable with public replies (`TW-04`)
  - the filter is keyboard-operable
- **V:** guard spec update; detail specs; screenshots.
- **NG:** note editing or deletion.

**RD-3.7 Composer v2: modes and input correctness**
- **Scope:**
  - new `ui/components/composer.tsx` shell; the ticket composer gets Reply / Internal note modes (notes use the existing notes mutation, which removes the second composer, `TW-04`)
  - @mention moves to the Combobox (fixing `A11Y-05`)
  - Enter-to-send ignores `isComposing` (the IME guard); the textarea stays enabled and focused after send (`A11Y-09`)
  - a visible Kbd hint
  - a sessionStorage draft per ticket and mode
  - sticky at the bottom of the main column
- **Dependencies:** RD-3.4, RD-3.6.
- **AC:**
  - Arabic IME composition never sends early (spec simulating composition events)
  - mode is announced
  - "Send by email" behaviour is unchanged
- **V:** composer specs; Playwright live-chat spec.
- **NG:** send-and-set-status (§12, optional).

**RD-3.8 Composer tools**
- **Scope:**
  - new `ui/components/file-dropzone.tsx` (labelled, localized); the attach button in the composer uploads through the existing ticket-attachments endpoint, and the attachments card adopts the same control (`A11Y-02`, `TW-12`)
  - quick replies as a searchable Combobox (replacing the `sm:w-64` Select)
  - "Insert KB link" from attached articles
  - the AI "Suggest reply" result gains "Insert into reply" (`TW-06`)
- **Dependencies:** RD-3.7.
- **AC:**
  - file inputs have accessible names
  - quick-reply insertion behaviour (insert vs append) is unchanged
  - AI insert does not auto-send
- **V:** specs.
- **NG:** message-level attachment linking; drag-drop multi-file upload if the endpoint is single-file (verify at Story start).

**RD-3.9 AI assist panel**
- **Scope:**
  - `ticket-ai-card.tsx` → an inspector or timeline-adjacent panel
  - the latest summary pinned and collapsible at the top of the timeline (client state only)
  - results announced via a polite live region
  - the Categorize "apply" action kept
- **Dependencies:** RD-3.6, RD-3.8.
- **AC:** PENDING → SUCCESS/ERROR transitions are announced; all four actions and the feature-flag-disabled state are preserved.
- **V:** AI card specs.
- **NG:** persisting results; new AI actions.

**RD-3.10 Knowledge-base references section**
- **Scope:** `ticket-kb-references-card.tsx`:
  - titles link to the article
  - unique accessible names ("Remove {title}", "Attach {title}")
  - debounced search
  - per-row pending state
  - restyled as an inspector section
- **Dependencies:** RD-3.3.
- **AC:** `A11Y-06` and `TW-13` resolved; the attach/remove mutations are unchanged.
- **V:** specs.
- **NG:** AI-suggested articles.

**RD-3.11 Customer context section**
- **Scope:** `customer-context-panel.tsx` → an inspector section showing:
  - the customer identity block (Avatar, name, status)
  - the raising contact, when `ticket.contactId` matches a contact already loaded
  - open tickets with the new badges
  - contacts as a DescriptionList
  - a contextual "View all {customer}'s tickets" link
  - uppercase removed (`VL-11`)
- **Dependencies:** RD-3.3, RD-1.14.
- **AC:** the existing data is shown and nothing is fetched beyond today's queries.
- **V:** panel specs.
- **NG:** lifetime CSAT or ticket-count KPIs (need the API).

**RD-3.12 Mobile and tablet ticket workspace, plus skeleton**
- **Scope:**
  - below `lg`: a compact sticky header, a `Tabs` segmented control (Conversation | Details) with the composer pinned on Conversation (`RS-02`)
  - `TicketDetailSkeleton` matches the new layout (`TW-16`)
  - fix the stale layout doc comments
- **Dependencies:** RD-3.1–RD-3.11.
- **AC:**
  - at 320px, status, SLA and composer are reachable without scrolling past the conversation
  - no horizontal scroll at 320/768 in en and ar
  - no layout shift between skeleton and content at 1280
- **V:** screenshot matrix; Playwright ticket specs at a mobile viewport (manual run).
- **NG:** native-app gestures.

**RD-3.13 Realtime change cues**
- **Scope:** when `use-ticket-realtime` updates status, priority or assignee from another actor, show a brief highlight on the changed header field and a polite announcement ("Status changed to Resolved") (`TW-15`).
- **Dependencies:** RD-3.1.
- **AC:** no announcement for the agent's own changes; respects reduced motion.
- **V:** hook and component specs.
- **NG:** collision detection, typing indicators (these need the backend).

**RD-3.14 Prev/next ticket and keyboard shortcuts (Low; requires §12 approval)**
- **Scope:**
  - prev/next within the current list query, read from the list's cached query and URL filters
  - shortcuts `r` (reply), `n` (note), `a` (assign to me), `j`/`k` (next/prev), disabled while typing in a field and listed in a Kbd help popover
- **Dependencies:** RD-3.2, RD-3.7.
- **AC:** shortcuts never fire inside inputs or during IME composition; every shortcut has a visible button equivalent.
- **V:** specs.
- **NG:** customisable shortcuts.

### Phase 4 — Agent Workspace

**RD-4.1 `ListToolbar` primitive and ticket-list adoption**
- **Scope:**
  - new `ui/components/list-toolbar.tsx`: search with icon, submit on Enter, clear; filter slot; result count (`role=status`); clear-all; a mobile sort Select
  - adopt it on the ticket list; pass `isFiltered` to QueryStateCard (`TK-05`, `TK-06`, `RS-03`)
- **Dependencies:** RD-1.9, RD-1.11.
- **AC:**
  - URL filter persistence is unchanged (`useUrlFilters` specs)
  - Enter searches
  - sorting is available below `sm`
- **V:** ui and list specs.
- **NG:** saved views.

**RD-4.2 Ticket queue quick views and SLA sort**
- **Scope:**
  - quick-view tabs: All / Mine / Unassigned / At risk / Breached. Each maps to **existing** query params; a view is dropped if no param supports it (verified at Story start).
  - "SLA urgency" sort using the existing `sortBy: "slaUrgency"` (`tickets-api.ts:159`) (`TK-02`, `TK-03`)
- **Dependencies:** RD-4.1, RD-1.15.
- **AC:** each view's URL is bookmarkable; requests match the existing API contract.
- **V:** list specs.
- **NG:** bulk actions; server-side saved views.

**RD-4.3 Ticket list visual v2**
- **Scope:**
  - compact density
  - status/priority badges and `SlaIndicator` cells
  - assignee avatar
  - relative "Updated" via `DateTime`, with the absolute time in a tooltip and accessible text (`TK-07`)
  - row hover
- **Dependencies:** RD-4.1, RD-1.14.
- **AC:** same 8 data points; sort controls preserved; `table-mobile-labels.spec.ts` green.
- **V:** list specs; screenshots.
- **NG:** column chooser.

**RD-4.4 Customer list v2**
- **Scope:**
  - ListToolbar
  - the status filter → FilterSelect
  - the shared list skeleton
  - compact table with Avatar
  - default sort aligned with tickets **only if** product approves (otherwise unchanged)
- **Dependencies:** RD-4.1.
- **AC:** existing filters, sort and pagination behave identically.
- **V:** customer list specs.
- **NG:** new columns that need API fields.

**RD-4.5 Customer detail v2**
- **Scope:** `customer-detail-view.tsx`:
  - an entity header (Avatar, name edit kept, status with a **ConfirmDialog** before change, which is an interaction change justified by the immediate-mutation risk)
  - a contacts section with "Add contact" in a Dialog (replacing the fixed-width inline form, `RS-07`)
  - the portal-password action moved into a contact row menu → Dialog
  - ticket rows that wrap (`RS-05`)
  - EmptyState instead of `<p>`
- **Dependencies:** RD-1.10, RD-2.3.
- **AC:** every mutation (rename, status, add contact, set portal password) works with the same payloads.
- **V:** customer detail specs.
- **NG:** customer KPIs needing the API.

**RD-4.6 Dashboard v2**
- **Scope:**
  - `StatCard` primitive with the `display` size and `tabular-nums`
  - KPI tiles that link to the matching ticket quick views (RD-4.2)
  - queue panels via QueryStateCard (replacing 3 hand-rolled blocks)
  - rows that wrap below `sm` (`dashboard-view.tsx:357`)
  - `tasks-panel.tsx` native `datetime-local` styled with control tokens
- **Dependencies:** RD-4.2.
- **AC:** the same data and actions (claim, tasks); no uppercase.
- **V:** dashboard specs.
- **NG:** making the dashboard the landing route (§12).

**RD-4.7 Knowledge base (agent): read mode and list**
- **Scope:**
  - `article-detail-view.tsx` gains a default **read view** (title, body in `body-lg`, `max-w-prose`, metadata, translation status) with an explicit "Edit" switching to today's editor (`KB-01`)
  - editor tabs default to the UI locale (`RTL-04`)
  - list: ListToolbar; `isFiltered` includes the category
  - "Unpublish" moves into a row menu
- **Dependencies:** RD-4.1, RD-1.10.
- **AC:** every edit and save path is unchanged; read mode is the default for all users (permission behaviour unchanged).
- **V:** KB specs; Playwright `kb-publish-portal-visibility.spec.ts`.
- **NG:** rich-text rendering (§10).

**RD-4.8 Notifications inbox (agent)**
- **Scope:** `notification-history-view.tsx`:
  - history first; preferences in a secondary section or tab
  - the event as text, not an outline Badge
  - links to the related ticket
  - the double `overflow-x-auto` removed (`RS-08`)
  - the FetchingIndicator moved into the PageHeader `meta` slot
- **Dependencies:** RD-2.4, RD-4.1.
- **AC:** the same data and pagination; the preferences mutations are unchanged.
- **V:** notifications specs.
- **NG:** a read/unread backend.

### Phase 5 — Customer Portal

**RD-5.1 Portal frame: width, padding and branding delivery**
- **Scope:**
  - content cap (`max-w-5xl`; reading surfaces `max-w-prose`) in the `(customer)` layout (`PT-01`)
  - `page-x` padding
  - investigate a server-side branding fetch; if the existing auth cookie permits it, pass branding in as `initialBranding` like web does, otherwise reserve the logo box and fade it in
  - Tier 1 brand panel on home
- **Dependencies:** RD-1.6, RD-2.3, RD-2.6.
- **AC:** no line longer than ~80ch on KB articles at 1280; no layout shift from the logo.
- **V:** portal specs; screenshots.
- **NG:** pre-auth branding.

**RD-5.2 Portal home v2**
- **Scope:**
  - primary calls to action: New ticket (existing create flow), Ask the assistant (`/chat`), Browse help (`/knowledge-base`)
  - recent tickets with `TicketStatusBadge`
  - headings via SectionCard (`text-subhead`)
  - remove the duplicated "Explore" block
- **Dependencies:** RD-5.1, RD-1.14.
- **AC:** each panel keeps its loading, error and empty states; one `h1`.
- **V:** home specs.
- **NG:** personalised content.

**RD-5.3 Portal tickets: list and create**
- **Scope:**
  - heading order fixed: page `h1` before the "Create" `h2` (`A11Y-04`)
  - create form on FormField with required markers
  - after a successful create, navigate to the new ticket **if the existing create response returns its id** (verified at Story start)
  - list rows with the new badges and `DateTime`
  - EmptyState
- **Dependencies:** RD-5.1, RD-1.9.
- **AC:**
  - `customer-submits-ticket.spec.ts` passes (selectors updated only where markup changed, documented)
  - no payload changes
- **V:** portal specs; Playwright.
- **NG:** description, attachment or managed-category fields (need the API, §10).

**RD-5.4 Portal ticket detail v2**
- **Scope:**
  - header with localized status/priority badges
  - conversation on `MessageThread` + `Composer` (`role="log"`, dates, IME guard, focus kept)
  - AI-replayed messages labelled correctly using the existing channel/author data (`portal/ticket-chat-card.tsx:85`)
  - closed-ticket hint above the composer
  - CSAT promoted to the top when the ticket is resolved
  - attachments via FileDropzone (`A11Y-02`); download errors caught
  - `text-red-700` removed
- **Dependencies:** RD-3.5, RD-3.7, RD-3.8, RD-5.1.
- **AC:** all existing actions (reply, upload, download, CSAT) are preserved; the CSAT radiogroup spec (Story 167) stays green.
- **V:** portal specs; Playwright live-chat spec (customer side).
- **NG:** blocking replies on closed tickets (a business rule).

**RD-5.5 Portal knowledge base**
- **Scope:**
  - list: a labelled `type=search` field via FormField
  - article: `body-lg` + `max-w-prose`, BackLink, and a "Still need help?" block linking to the existing `/tickets` and `/chat` routes
- **Dependencies:** RD-5.1.
- **AC:** KB search behaviour is unchanged; the article error state uses ErrorState (via RD-2.5).
- **V:** KB specs; Playwright KB visibility spec.
- **NG:** "Was this helpful?" (needs the API), categories browse (needs the API unless one already exists; verify).

**RD-5.6 Portal assistant chat v2**
- **Scope:** `chat-widget.tsx`:
  - a page `h1` (`A11Y-03`)
  - a full-height chat layout instead of the `max-h-80` box
  - `MessageThread` with `role="log"`
  - "Thinking…" as a `role=status`
  - a localized error replacing the raw `errorMessage`, with a retry when the session fails to start
  - an escalation ConfirmDialog
  - bubble colours from tokens
- **Dependencies:** RD-3.5, RD-3.7.
- **AC:** the escalation flow and navigation are unchanged after confirmation; announcements work in a screen-reader smoke test.
- **V:** chat specs; Playwright live-chat spec.
- **NG:** session resume across navigation (§10) unless the existing API already supports it (verify).

**RD-5.7 Portal notifications and account**
- **Scope:**
  - `Switch` primitive for the preferences (replacing the button-plus-pill, with raw emerald removed)
  - inline errors announced
  - history first, with EmptyState and Badge
  - account and change-password: consistent SectionCard headings across the form and success states
- **Dependencies:** RD-1.8, RD-1.10.
- **AC:** the preference and password mutations are unchanged; the Switch has a correct `role="switch"` name and state.
- **V:** portal specs.
- **NG:** profile editing (needs the API).

### Phase 6 — Admin & Reports

**RD-6.1 `Sheet` primitive and Users admin**
- **Scope:**
  - `ui/components/sheet.tsx` (slides from inline-end and mirrors in RTL; focus trap; sizes)
  - `user-list-view.tsx` becomes a read-only compact table (Avatar, name, email, role, department, status) with a row action that opens a Sheet editor holding today's controls (email, full name, role, department, password reset, activate/unlock) (`AD-01`)
- **Dependencies:** RD-1.10, RD-1.11.
- **AC:** every existing user mutation is reachable with the same payloads and permission handling; the table has no inline inputs.
- **V:** users specs; identity e2e is not affected (frontend only).
- **NG:** a user detail route (routing preserved).

**RD-6.2 SLA policies**
- **Scope:** inline `w-24` target inputs → Sheet editor; priority via `TicketPriorityBadge`; QueryStateCard.
- **Dependencies:** RD-6.1, RD-1.14.
- **AC:** same mutations.
- **V:** SLA specs.
- **NG:** SLA computation.

**RD-6.3 Roles and permissions**
- **Scope:** the permission editor moves from inside a table cell to a Sheet with a grouped checkbox grid.
- **Dependencies:** RD-6.1.
- **AC:** same grant/revoke payloads.
- **V:** roles specs.
- **NG:** permission-model changes.

**RD-6.4 Branches, departments and categories**
- **Scope:** `branch-departments-view.tsx`, `ticket-categories-view.tsx`, `kb-categories-view.tsx`: inline rename → Dialog; consistent list layout; restyle the near-duplicate category views identically (no merge required).
- **Dependencies:** RD-2.4, RD-6.1.
- **AC:** same mutations; one `h1` in every state.
- **V:** specs.
- **NG:** merging the two category modules.

**RD-6.5 Settings, business hours and AI settings**
- **Scope:**
  - Settings tabs reflect the active tab in a `?tab=` query param (no route change)
  - business-hours weekday layout without fixed `w-24`
  - consistent form sections
- **Dependencies:** RD-2.4.
- **AC:** every setting saves as before; deep-linking to a tab works.
- **V:** settings specs.
- **NG:** moving `/branding` etc. into nav (§12).

**RD-6.6 System screens**
- **Scope:** API keys, webhooks, automation rules, quick replies, notification templates:
  - SectionCard headings (removing the 5 raw `h2 text-sm`)
  - QueryStateCard
  - `ActiveBadge` pattern (11 sites)
  - `DateTime`
- **Dependencies:** RD-1.10, RD-1.17.
- **AC:** same data and mutations.
- **V:** specs.
- **NG:** new system features.

**RD-6.7 Audit log**
- **Scope:**
  - ListToolbar
  - filters become Selects of known action and entity values **only where the frontend already knows the set**, otherwise free text is kept with helper text
  - localized labels for known action codes, with a raw-code fallback
  - the diff opens in a Sheet instead of a nested-scroll `pre` (`RS-08`)
- **Dependencies:** RD-4.1, RD-6.1.
- **AC:** the same API queries.
- **V:** audit-log specs.
- **NG:** new audit endpoints.

**RD-6.8 Reports v2**
- **Scope:**
  - one page-level Alert for an invalid range or forbidden state instead of up to 7 per-card repeats (`RP-01`)
  - the three filter rows → one toolbar
  - `StatCard` for KPIs
  - `ReportCard` → SectionCard
  - filters mirrored to the URL using the existing `useUrlFilters` pattern (an interaction change justified by `RP-01`/`VL-07`)
  - chart colours verified in dark mode and against RD-1.14
- **Dependencies:** RD-4.1, RD-4.6, RD-1.14.
- **AC:** same report requests; saved views still work.
- **V:** reporting specs; dark screenshot.
- **NG:** a chart library; new reports.

**RD-6.9 Create-form pages**
- **Scope:**
  - `create-ticket-view.tsx`, `create-customer-view.tsx`, `create-user-view.tsx`, `create-sla-policy-view.tsx`, `create-article-view.tsx`: Card surface, FormField, required markers, Cancel (BackLink to the list), and the error Alert near the submit button
  - the create-ticket customer field becomes a Combobox (client-side filter over the existing list query, or the existing search param)
  - the Link nested inside a `<label>` is fixed
- **Dependencies:** RD-1.9, RD-3.4.
- **AC:** same payloads and navigation after create; a disabled submit explains why (hint text).
- **V:** create-view specs; Playwright `agent-resolves-ticket` (if it creates tickets via the UI).
- **NG:** new fields.

### Phase 7 — Cross-Product Polish & Closeout

**RD-7.1 FormField adoption sweep and guard**
- **Scope:** replace the remaining hand-rolled `<label className="flex flex-col …">` fields (73 web + 4 portal at recon time, minus those already migrated); add a guard spec against the pattern.
- **Dependencies:** Phases 4–6.
- **AC:** 0 hand-rolled label wrappers; every control's error is associated (`aria-describedby`).
- **V:** app specs.
- **NG:** form behaviour changes.

**RD-7.2 State-pattern sweep and guard**
- **Scope:** the remaining hand-rolled loading/error/empty triplets → QueryStateCard / EmptyState / ErrorState; plus a guard against `<p className=…text-ink-subtle>` empty messages where feasible.
- **Dependencies:** Phases 4–6.
- **AC:** every list view uses QueryStateCard; every detail error uses ErrorState.
- **V:** specs.
- **NG:** new states.

**RD-7.3 Inline error announcements**
- **Scope:** give the ~37 inline `text-danger-foreground` messages `role="alert"`, or associate them via FormField (`A11Y-07`).
- **Dependencies:** RD-7.1.
- **AC:** 0 unannounced inline errors (guard or spec).
- **V:** specs.
- **NG:** copy changes.

**RD-7.4 Responsive pass**
- **Scope:** the full route list × {320, 768, 1280} × {en, ar}; fix residual overflow, non-wrapping rows and nested scroll (`RS-05`, `RS-07`, `RS-08` remainders).
- **Dependencies:** Phases 2–6.
- **AC:** no horizontal page scroll on any route at 320px; tables scroll only inside their wrapper.
- **V:** screenshot matrix (after) versus RD-0.2 (before).
- **NG:** new breakpoints strategy.

**RD-7.5 RTL/LTR parity pass**
- **Scope:** every route in ar/RTL versus en/LTR:
  - icon flips (directional only)
  - punctuation and number direction in mixed strings (ticket ids, emails, URLs wrapped in `dir="ltr"`/`<bdi>` where needed)
  - no Latin enum leaks
  - docs updated
- **Dependencies:** Phases 2–6.
- **AC:** the parity checklist (§9.3) passes for every route; the physical-direction guard is green.
- **V:** screenshot matrix in ar.
- **NG:** translation copy rewrite.

**RD-7.6 Dark mode and branding pass**
- **Scope:** every route in dark mode plus 4 reference brands (indigo default, a passing green, a failing yellow, a failing red); fix residual contrast and asset issues (logo plate, charts, focus visibility).
- **Dependencies:** Phases 1–6.
- **AC:** §11 dark and branding criteria are met.
- **V:** screenshot matrix; manual contrast spot-checks with browser devtools.
- **NG:** new theme variants.

**RD-7.7 Accessibility audit pass**
- **Scope:**
  - a keyboard-only walk of every route
  - the heading outline per route
  - landmarks
  - focus visibility in both themes
  - a screen-reader smoke test (NVDA or VoiceOver) of ticket workspace, portal chat and portal ticket detail
  - an automated scan with a browser extension (axe DevTools or Lighthouse), run manually and **not added to CI**
  - fix the findings or record them as deferred
- **Dependencies:** Phases 1–6.
- **AC:** 0 critical or serious automated violations on the audited routes; every recon `A11Y-*` finding is closed or explicitly deferred with a reason.
- **V:** audit log in the completion report.
- **NG:** WCAG AAA.

**RD-7.8 Design-system documentation closeout**
- **Scope:**
  - update `docs/architecture/13-design-language.md` with what actually shipped
  - refresh the stale doc comments flagged by recon (e.g. the `tailwind-preset.js` "DEFINED BUT UNADOPTED" note, the ticket-detail layout comments)
  - an index of primitives and patterns with usage rules
- **Dependencies:** all.
- **AC:** the docs match the code.
- **V:** review.
- **NG:** Storybook.

---

## 7. Priority Matrix

Priority reflects recon severity and how much each Story unblocks.

| Priority | Stories | Driving findings |
|---|---|---|
| **Critical** | RD-1.1, RD-1.4, RD-1.14, RD-1.16, RD-3.1, RD-3.3, RD-3.5, RD-3.6, RD-3.7 | DS-01/06 (identity, dark mode is a confirmed requirement), VL-04, TK-01/TW-10/PT-04 (i18n leaks), TW-01/02/03/04/05 (centrepiece), A11Y-01 |
| **High** | RD-0.1, RD-1.2, RD-1.3, RD-1.5, RD-1.6, RD-1.8, RD-1.9, RD-1.10, RD-1.15, RD-2.1, RD-2.5, RD-2.6, RD-3.2, RD-3.4, RD-3.8, RD-3.12, RD-4.1, RD-4.2, RD-4.7, RD-5.1, RD-5.3, RD-5.4, RD-5.6, RD-6.1 | VL-01/02/03, A11Y-02/03/12, TW-06/08/09/12, RS-02, TK-02/03/05, KB-01, PT-01/03/06, AD-01, NAV-05 |
| **Medium** | RD-0.2, RD-1.7, RD-1.11, RD-1.12, RD-1.13, RD-1.17, RD-2.2, RD-2.3, RD-2.4, RD-3.9, RD-3.10, RD-3.11, RD-3.13, RD-4.3, RD-4.4, RD-4.5, RD-4.6, RD-4.8, RD-5.2, RD-5.5, RD-5.7, RD-6.2, RD-6.3, RD-6.4, RD-6.7, RD-6.8, RD-6.9, RD-7.1, RD-7.2, RD-7.3, RD-7.4, RD-7.5, RD-7.6, RD-7.7 | VL-05/07/08/09, RS-01/03/05, A11Y-04/05/06/07/10/11, TW-13/15/16, RP-01 |
| **Low** | RD-3.14, RD-6.5, RD-6.6, RD-7.8 | Optional interaction additions, consistency-only screens, documentation |

Counts: Critical 9 · High 24 · Medium 34 · Low 4 = **71**.

---

## 8. Risk / Dependency Map

### 8.1 Critical path

```
RD-0.1 ─► RD-1.1 ─► RD-1.2 ─► RD-1.3 ─► RD-1.4 ─► RD-1.5 ─► RD-1.6 ─► RD-1.7
                 │         └─► RD-1.8 ─► RD-1.13, RD-1.14 ─► RD-1.15
                 │         └─► RD-1.9, RD-1.10, RD-1.11, RD-1.12
RD-1.16, RD-1.17 (parallel to the token chain)
Phase 1 ─► RD-2.1/2.2/2.3 ─► RD-2.4, RD-2.5, RD-2.6
Phase 2 + RD-1.14/1.15 ─► RD-3.1 ─► RD-3.2, RD-3.3 ─► RD-3.4 ─► RD-3.5 ─► RD-3.6 ─► RD-3.7 ─► RD-3.8 ─► RD-3.9
                                                            RD-3.10, RD-3.11, RD-3.13 (after RD-3.3/3.1)
                                                            RD-3.12 (after RD-3.1–3.11) ─► RD-3.14
RD-1.9/1.11 ─► RD-4.1 ─► RD-4.2 … RD-4.8
RD-3.5/3.7/3.8 ─► RD-5.4, RD-5.6 (shared thread and composer)
RD-1.10/1.11 ─► RD-6.1 ─► RD-6.2, 6.3, 6.4, 6.7
Phases 1–6 ─► Phase 7
```

**Hard ordering rules:**
- Tokens (RD-1.1–1.4) come before any screen restyle. Raw-palette removal (RD-1.3) comes before dark mode (RD-1.4).
- Shell (Phase 2) comes before the ticket workspace's sticky header and composer.
- Combobox (RD-3.4) comes before the mention list and quick replies (RD-3.7/3.8) and the create-ticket customer picker (RD-6.9).
- MessageThread and Composer (RD-3.5/3.7) come before the portal conversation and chat (RD-5.4/5.6).
- Sheet (RD-6.1) comes before every admin editor migration.

### 8.2 Where a visual change can accidentally change behaviour

| Risk | Where | Mitigation |
|---|---|---|
| Moving JSX drops a section or a mutation handler | Ticket workspace (RD-3.x), customer detail, users admin | Section-survival guard specs (Story 156 precedent); mutation-payload assertions kept; one bounded Story at a time |
| Changed markup breaks Playwright selectors | `agent-resolves-ticket`, `agent-customer-live-chat`, `customer-submits-ticket`, `kb-publish-portal-visibility`, `admin-navigation-layout` | Prefer role- and label-based selectors; update a selector only when the markup legitimately changed, with the reason recorded; never weaken an assertion |
| Disabled or enabled state changes timing | Composer keeps the textarea enabled while sending (RD-3.7) | Double-send guard stays on the button; spec asserts a single request |
| Inline edit → Dialog/Sheet changes focus and commit timing | Users, SLA, roles, branches, customer contacts | Same mutation hooks; explicit Save/Cancel; focus-return specs |
| Collapsible sections hide content | Inspector (RD-3.3) | Expanded by default; state is client-only; content still in the DOM for search and print where feasible |
| Header actions duplicate inspector controls | RD-3.2 | Both call the same mutation function; a spec asserts identical payloads |
| URL-state additions | Reports (RD-6.8), Settings tab (RD-6.5), quick views (RD-4.2) | Reuse `useUrlFilters`; unknown params ignored; defaults identical to today |
| Toast region always mounted | RD-1.13 | Spec that it renders empty and silent |
| `cn` merge regressions from new scales | RD-1.2 | Register every scale in `cn.ts` with specs (Story 172 precedent) |

### 8.3 Dark-mode risks
- **Off-token colours stay light.** Mitigated by RD-1.3's guard, which runs before RD-1.4.
- **`danger-solid` used as text fails in dark** (3.70:1). RD-1.3 moves it to `danger-foreground`.
- **Logos vanish on dark headers.** Logo plate (RD-1.4); a dark-logo field is deferred (§10).
- **Charts.** CSS-var based, so they should adapt. Verified in RD-6.8 and RD-7.6.
- **Native controls** (date input, file input, scrollbars) need `color-scheme`. Set in RD-1.4.
- **Flash of the wrong theme.** The cookie is read server-side; "system" uses a CSS media query, so no script is required.
- **Shadows invisible in dark.** Depth comes from `surface-raised` plus borders.
- **Focus ring visibility.** A separate dark `focus` value; checked against the raised surface (7.34).

### 8.4 Branch-branding risks
- **Unreadable buttons.** The Tier 2 contrast gates; fallback to core.
- **Brand colour mistaken for meaning** (a red brand reads as danger). Hue gate (c); semantics are never overridden.
- **Product fragmentation across branches.** Neutrals, type, radius, layout and semantics are fixed; only the accent and decorative brand surfaces vary.
- **Portal flash** (client-side branding). RD-5.1.
- **Admin surprise.** Live preview and verdict (RD-1.7).
- **`secondaryColor` misuse.** Decorative gradient only.

### 8.5 RTL/LTR risks
- **Over-flipping non-directional icons** (clock, check, search). An explicit allow-list in `icons.ts` docs and BackLink.
- **Sheet and toast slide directions.** Logical inline-end, with specs on the computed classes.
- **Mixed-direction strings** (ticket ids, emails, phone numbers, URLs). `<bdi>` / `dir="ltr"` wrappers (RD-7.5).
- **Letter-spacing and uppercase on Arabic.** `:lang(ar)` reset (RD-1.2); uppercase removals (RD-1.11, RD-3.11, RD-4.6).
- **Combobox and Popover positioning.** Radix `dir`; the hand-positioned mention list is removed (RD-3.7).
- **Digits.** Pending the §12 decision; centralised in RD-1.17 so it can be switched in one place.

### 8.6 Accessibility risks
- **Live regions over-announcing** (timeline, realtime cues). Polite only; no announcements for the agent's own actions; specs.
- **Collapsible and segmented content hiding focus targets.** Tabs and sections use Radix semantics; a keyboard walk in RD-3.12 and RD-7.7.
- **Keyboard shortcuts conflicting with assistive tech or IME.** Off inside fields and during composition; optional (RD-3.14, needs approval).
- **New colours below contrast.** All pairs were computed for this plan; RD-1.1 and RD-1.4 add specs.
- **Sticky regions covering focused elements.** `scroll-padding-top` matching the sticky header height (RD-3.1).

### 8.7 Responsive risks
- **Larger default control height (36 → 40px) reflows the 320px header**, where Story 173 measured overflow at 360 and 372px. RD-1.5 and RD-2.1 re-measure; the hamburger moves into the header row.
- **Sticky header plus sticky composer squeeze phone viewports.** RD-3.12 uses the segmented layout below `lg` and a compact header.
- **Tables:** the mobile card mode stays (`table-mobile-labels.spec.ts`).
- **Sheets on phones** go full width below `sm`.

---

## 9. Verification Strategy

Only infrastructure that **exists today** is assumed:
- **Vitest + Testing Library + jsdom** in `packages/ui`, `apps/web`, `apps/portal`.
- **Guard specs** in `apps/*/src/test/*`, e.g. `tailwind-content.spec.ts`, `table-mobile-labels.spec.ts`, `ticket-enum-messages.spec.ts`, `not-found-css.spec.ts`.
- **Playwright** critical-flow suite in `apps/e2e` (7 specs).
- **CI** (`.github/workflows/ci.yml`): lint → typecheck → build → tests.

There is **no** visual-regression or automated-axe infrastructure; this plan does not add any to CI.

### 9.1 Every Story
1. Its own acceptance criteria, checked one by one in the completion report.
2. Unit and component specs for every new or changed primitive and pattern. Specs assert **roles, names, ARIA state, keyboard behaviour and class tokens**. jsdom cannot evaluate media queries or layout, so layout claims are verified manually.
3. `pnpm --filter @crm/ui test`, `pnpm --filter @crm/web test` and `pnpm --filter @crm/portal test` (as relevant), then `pnpm typecheck`, `pnpm lint`, `pnpm build`.
4. Any Playwright spec touching the changed screen (`pnpm --filter @crm/e2e test`, against the local stack) when the Story changes markup on that flow. Environmental blockers are reported per `CLAUDE.md` §5.
5. `git status --short` shows only the Story's files.

### 9.2 Visual/manual matrix (per Story, scoped to the screens it changes)

| Dimension | Values | When required |
|---|---|---|
| Width | 320 · 768 · 1280 | Any layout change |
| Locale / direction | en (LTR) · ar (RTL) | Always |
| Theme | light · dark | From RD-1.4 onward |
| Branding | none · one passing brand · one failing brand | Stories touching shell, accent or branded surfaces |
| Evidence | Before/after screenshots (ad-hoc Playwright script or manual DevTools), listed in the completion report and not committed | Any visible change |

### 9.3 Checklists
- **RTL/LTR:**
  - directional icons flip and others don't
  - logical spacing (guard spec)
  - mixed-direction strings isolated
  - no Latin enum or unit leaks in ar
  - no `uppercase`/`tracking` on Arabic
- **Accessibility:**
  - one `h1`, ordered headings
  - every control named (no placeholder-as-label)
  - visible focus in both themes
  - live regions for self-updating content
  - dialogs and sheets trap and restore focus
  - colour is never the only signal
  - contrast pairs per §2.2
  - keyboard-only completion of the Story's flows
  - reduced motion respected
- **Dark mode:** no off-token colours (guard); readable charts, logos and native controls; focus visible on raised surfaces.
- **Branding:** semantic, focus and neutral tokens unchanged (spec from RD-1.6); Tier 2 fallback behaves as specified.
- **Responsive:** no horizontal page scroll at 320; touch targets ≥ 24px (≥ 40 for primary actions below `sm`); sticky elements never cover the focused element.

### 9.4 Phase exit checks
- **Phase 1:** primitives specs complete; guard specs active; the light/dark baseline set re-captured.
- **Phase 3:** a screen-reader smoke test (NVDA or VoiceOver) of the conversation, composer and inspector; both ticket Playwright specs green.
- **Phase 7:** the full matrix on every route; a manual automated-a11y scan (browser extension) recorded.

---

## 10. Scope Guardrails

This redesign does **not** include the following, unless a future Story explicitly requires it and is separately approved:

- **Backend, API or database redesign:** no new endpoints, fields, migrations or Prisma changes. Items explicitly blocked on this:
  - forgot/reset password (an SMTP adapter exists in `apps/worker`; the auth flow does not)
  - portal ticket description and attachments at create
  - managed categories in the portal
  - "was this helpful"
  - KB categories browse (unless an endpoint already exists)
  - chat session resume
  - pre-auth branding (`/portal/branding` requires auth)
  - per-user server-side theme
  - a dark-logo upload field
  - unread/read notification state
  - collision and typing indicators
  - merge/split/related tickets
  - manual escalation
  - AI result persistence
  - message-level attachments
  - customer KPIs
- **Business-rule changes:** status transitions, SLA computation (the at-risk tier is presentation-only), AI flags, CSAT rules, reply rules on closed tickets.
- **Authentication-architecture changes.**
- **Routing changes:** URLs, route groups, the landing route and locale prefixes stay as they are. Query params are added only where specified (`?tab=`, report filters, quick views via existing params).
- **Permission or navigation-visibility behaviour.** `NAV-01` stays as documented by Stories 44/129 unless approved (§12).
- **Performance optimisation** beyond not regressing it.
- **Framework or library replacement:** no change from Next.js, Tailwind 3, Radix or lucide; no new UI kit; no `tailwindcss-animate`; no chart library; no colour library (OKLCH maths is implemented in `brand.ts`).
- **Rich-text editing or rendering** for KB and messages.
- **New channels or providers** (`CLAUDE.md` §2).
- **Unrelated refactors:** non-visual cross-app duplicates (NavigationOverlayListener, AuthRecoveryListener, QueryProvider, `notifications-store`) stay as they are; only UI-visible duplicates are consolidated.
- **Storybook or a docs site; visual-regression or axe CI tooling.**
- **The pre-existing `identity.e2e-spec.ts` isolation defects** (`CLAUDE.md` §5/§13).
- **Global search and a command palette** (new features; §12).

---

## 11. Definition of Done — "CRM redesign complete"

The track is complete when **all** of the following hold, verified on every route in `apps/web` and `apps/portal`:

**Visual consistency**
- [ ] 0 raw Tailwind palette classes and 0 hex colours in component code (guard spec, RD-1.3).
- [ ] 0 raw `text-xs|sm|base|lg|xl|2xl` and arbitrary `text-[..]` in app screens; the named type scale only (guard spec, Phase 7).
- [ ] Every page starts with `PageHeader` at the top of `<main>`, with exactly one `h1` in every state, including loading and error.
- [ ] Radius and elevation come only from tokens (`rounded-control`/`surface`/`inner`/`pill`; `shadow-resting`/`raised`/`overlay`).

**Ticket UX**
- [ ] At 1280px an agent sees status, priority, SLA (with its target type) and assignee in the header without scrolling, and can reply or note without scrolling.
- [ ] One composer with Reply/Note modes; notes are visually distinct (tint, icon, label).
- [ ] One chronological timeline of messages, notes and localized events, with actor.
- [ ] AI suggested replies can be inserted into the composer.
- [ ] The section-survival guard spec covers every pre-redesign section and action, and both ticket Playwright specs pass.

**Shared components**
- [ ] Status, priority and SLA each render through one component per concept; the duplicate maps are deleted.
- [ ] Message thread and composer: one generic implementation, used by web ticket, portal ticket and portal chat.
- [ ] 0 hand-rolled label wrappers (FormField everywhere); 0 hand-rolled loading/error/empty triplets in list and detail views.
- [ ] Locale and theme switchers, BackLink, ErrorState and Toast exist once and are used everywhere relevant.

**Light/dark mode**
- [ ] Every route is usable in light, dark and system, with no flash on load.
- [ ] All §2.2 contrast pairs pass in both modes (specs); no off-token colour exists.

**Branch branding**
- [ ] Tier 1 is applied on both apps' authenticated shells; Tier 2 applies only when the gates pass (spec over reference colours).
- [ ] Semantic, focus and neutral tokens are provably unaffected by any brand input (spec).
- [ ] Admins see a live preview and verdict.

**Arabic/English and RTL/LTR**
- [ ] 0 raw enum or unit strings visible in either locale (enum-parity specs cover every enum shown in the UI).
- [ ] 0 physical-direction utilities (guard spec); directional icons only flip per the allow-list.
- [ ] All dates and times go through the locale-aware helper (guard against inline `toLocale*String(`).
- [ ] The RTL parity checklist (§9.3) passes on every route.

**Responsive**
- [ ] No horizontal page scroll at 320px on any route in en or ar, light or dark.
- [ ] The ticket workspace is fully operable at 320 and 768 (segmented layout).
- [ ] Tables keep their mobile card mode, with a sort control available below `sm`.

**Accessibility**
- [ ] Every recon `A11Y-*` finding is closed or explicitly deferred with a reason.
- [ ] Conversation and chat threads are live regions; realtime changes are announced politely.
- [ ] Every control has an accessible name, including file inputs and repeated row actions.
- [ ] A keyboard-only walk of every route passes; focus is visible in both themes; reduced motion is respected.
- [ ] A manual automated scan (browser axe or Lighthouse) shows 0 critical or serious violations on the audited routes.

**Loading, empty and error states**
- [ ] Every list uses `QueryStateCard` (with `isFiltered` where filters exist); every detail error uses `ErrorState` with retry and a way back.
- [ ] Route skeletons match their page's layout (no two-step layout shift on ticket detail and lists).

**Process**
- [ ] Every Story landed as its own commit with a completion report containing before/after evidence; `00-index.md` lists the track.

---

## 12. Decisions requiring approval

These are **not** settled by the confirmed direction. Each has a recommended default that the plan assumes unless overridden.

| # | Decision | Recommendation (assumed) | Affects |
|---|---|---|---|
| D1 | Core accent hue | **Indigo** (`#4F46E5` light / `#818CF8` dark), per §2.1 | RD-1.1 onward |
| D2 | Tier 2 brand accent (branch colour drives buttons and links when gates pass) | **On by default when gates pass**; otherwise Tier 1 only | RD-1.6, RD-1.7 |
| D3 | SLA "at risk" threshold (presentation only) | **≤ 25% of the governing target window remaining, or ≤ 60 minutes, whichever comes first**. The window is measured from ticket creation, so this uses existing fields | RD-1.15, RD-4.2 |
| D4 | Numerals in Arabic UI | **Keep current behaviour** (`Intl` `ar`, i.e. Arabic-Indic digits). Alternative: Latin digits via `ar-u-nu-latn` | RD-1.17 |
| D5 | Theme persistence | **Cookie per browser** (no schema change). A per-user DB preference is a separate, out-of-scope Story | RD-1.4 |
| D6 | Permission-aware navigation (`NAV-01`) | **Not in this track** (documented existing behaviour); propose it separately if wanted | RD-2.2 |
| D7 | Landing route `/tickets` → `/dashboard` | **No change** (routing preserved) | RD-4.6 |
| D8 | Keyboard shortcuts and prev/next ticket | **Include as Low priority (RD-3.14)**, optional | RD-3.14 |
| D9 | "Send and set status" in the composer | **Exclude** (adds a combined action); revisit after RD-3.7 | RD-3.7 |
| D10 | Logo on dark backgrounds | **Light logo plate** in dark mode; no new upload field | RD-1.4 |
| D11 | Default control height 36 → 40px | **Yes** (comfortable direction); re-measure the 320px header | RD-1.8 |
| D12 | Ticket presentation constants in `@crm/shared` | **Yes** (both apps already depend on it; pure data) | RD-1.14 |
