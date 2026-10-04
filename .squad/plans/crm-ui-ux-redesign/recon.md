# CRM UI/UX Redesign — Recon / Audit

**Status:** Reconnaissance only. No source, test, config or token file was changed to produce this report.
**Baseline:** `main` @ `3461bcf` (clean working tree), audited 2026-10-04.
**Scope read:** `apps/web/src`, `apps/portal/src`, `packages/ui/src`, `packages/config`, both apps' `tailwind.config.ts` / `globals.css`, `docs/architecture/01-technology-stack.md`, `docs/architecture/10-i18n-and-rtl.md`, and prior UI plans under `.squad/plans/**`.

Paths are repo-relative. `web/` = `apps/web/src/`, `portal/` = `apps/portal/src/`, `ui/` = `packages/ui/src/`. Counts exclude `*.spec.*` files and, where stated, comment lines. This codebase has unusually long doc comments that quote class strings, so naive grep counts over-report.

Findings carry IDs (e.g. `TK-03`) so later plans can cite them. Severity scale: **Critical / High / Medium / Low**.

---

## 1. Executive Summary

The CRM is **not** starting from a blank or chaotic UI. Stories ~134–176 already did a lot of hardening:

- semantic tokens (`packages/config/tailwind-tokens.css`)
- a shared `@crm/ui` package consumed by both apps
- Card / EmptyState / QueryStateCard adoption passes
- mobile-stacking tables
- a two-column ticket workspace (Story 156)
- a named type scale
- loading-state and focus accessibility passes
- a modern split login screen (Story 175)

RTL hygiene is excellent: **zero physical-direction utilities** in either app or in `@crm/ui`.

What the product lacks is a **visual identity and a workflow-first information architecture**. It is correct, accessible-by-default, consistent-enough plumbing wearing a neutral slate skin. The result reads as "a collection of feature screens", which is exactly the concern that motivated this track.

The root causes:

1. **No brand or colour identity.** `--accent` is slate-900 (`packages/config/tailwind-tokens.css`, `--accent: 15 23 42`). Every primary button, active state and chat bubble is near-black. Branch `primaryColor` only tints a 2px header border; `secondaryColor` is used nowhere. There is no dark mode.
2. **The token system is only half-spent.** Seven named text sizes exist, but apps use only `title` and `subhead`; screens still use `text-xs` ×149 and `text-sm` ×120 in web. Spacing tokens: ~33 uses against 319 numeric `gap-N`. `rounded-inner` is used 0 times and `shadow-overlay` 0 times. The shadcn alias variables (`--primary`, `--muted-foreground`, …) are defined but **unmapped**, so they can't be used.
3. **Higher-level primitives are under-adopted:**
   - `Dialog`: 0 app usages
   - `FormField`: 2 web files, against 73 hand-rolled `<label className=…>` fields
   - `QueryStateCard`: 8 of ~23 data views
   - `FilterBar`: 3 views
   - `EmptyState`: 0 in portal
4. **CRM patterns are copy-pasted rather than modelled:**
   - message thread + composer: 3 copies
   - SLA indicator: 3
   - status/priority badge mapping: 2 copies plus a hand-mirrored chart map
   - back link: 5
   - activity list: ~15
   - locale switcher: 4
   - active/inactive badge: 11
5. **The ticket workspace is a stack of 11 equal-weight bordered cards.**
   - The header carries no status/priority/SLA/assignee summary and no action bar.
   - Notes, AI, attachments and KB each live in separate cards away from the composer.
   - Nothing is sticky.
   - There is no unified timeline.
6. **Admin screens edit inside table cells.** Users, SLA policies and branches build entire forms in rows because there is no Dialog/Sheet pattern in use.
7. **i18n leaks in high-traffic places.** The ticket-list status/priority filters show raw `IN_PROGRESS`/`URGENT` to Arabic users. History rows show raw `eventType`. Portal ticket priority is a raw enum. SLA remaining time is hard-coded `2h 15m`.

**Overall verdict:** strong foundations, weak expression. The redesign should be **a visual-language + IA redesign built on the existing `@crm/ui` and token architecture**, not a rewrite. Most of the risk sits in the ticket workspace and the admin edit pattern. Most of the leverage sits in the tokens and ~10 new shared primitives/patterns.

**Recommended next step:** produce a short **Design Direction** doc (brand accent, neutral ramp, density, radius/elevation, dark-mode decision) and convert §12–§13 into a `.squad/plans/crm-ui-ux-redesign/00-overview.md` with Phase 0 (tokens + i18n leaks) as the first Story.

---

## 2. Current Design System

### 2.1 Where it lives

| Layer | File | Status |
|---|---|---|
| CSS variables (RGB channels, light only) | `packages/config/tailwind-tokens.css` | **Centralized**; imported by both `apps/*/src/app/globals.css` (which contain only `@import` + `@tailwind`) |
| Tailwind theme extension | `packages/config/tailwind-preset.js` | **Centralized**; spread into each app's `theme.extend` (not via `presets`, deliberately: see the file header) |
| Components | `packages/ui/src/components/*` (30 components, each with a vitest spec) | **Centralized**, domain-free, all strings via props |
| Icons | `packages/ui/src/lib/icons.ts` (~40 semantic lucide re-exports) | **Centralized**; apps never import lucide directly |
| class merge | `packages/ui/src/lib/cn.ts` (tailwind-merge taught the custom scales, Story 172) | Centralized; portal never calls `cn(` (0 uses, 6 template literals) |
| Fonts | `apps/web/src/lib/fonts.ts`, `apps/portal/src/lib/fonts.ts` | **Duplicated** (identical files) |
| Design documentation | Only doc comments in the token/preset files. No Storybook, no design doc. `docs/architecture/01-technology-stack.md:10` just says "Tailwind CSS + shadcn/ui" | **Missing** |

### 2.2 Tokens

| Token family | Definition | Adoption | Assessment |
|---|---|---|---|
| **Colour: neutrals** (`surface` / `sunk` / `muted`, `ink` / `strong` / `muted` / `subtle`, `rule` / `strong` / `subtle`) | tokens.css; all ink steps documented AA (`ink-subtle` 4.8:1) | High. web: `text-ink-subtle` 116, `text-ink-muted` 73, `bg-surface` 31, `border-rule*` 35 | **Good**: semantic, contrast-checked |
| **Colour: accent** | `--accent: 15 23 42` (slate-900), `--accent-surface` slate-100 | `bg-accent` web 13 / portal 10 | **Problem (DS-01)**: there is no brand hue; see §3 |
| **Colour: status** (`success`/`warning`/`danger`/`info` × subtle/surface/border/solid/foreground) | tokens.css | `danger-*` web 45; `success-*`/`warning-*`/`info-*` used by apps **0** times directly (only via Badge/Alert) | Good palette, under-used; raw `emerald`/`amber`/`red` used instead in 8 places |
| **shadcn aliases** (`--primary`, `--muted-foreground`, `--background`, …) | tokens.css `:root` | **0**; not mapped in the preset, so `bg-primary` etc. don't generate | **DS-02 (Medium)**: dead aliases plus `apps/web/components.json` (`cssVariables: true`) mean any shadcn-CLI-scaffolded component would silently render unstyled |
| **Focus** | `--focus` blue-700; `.focus-ring`, `.focus-ring-always`, `.skip-link` utilities | Broad | **Good** |
| **Type scale** | preset `fontSize`: caption 12, label 12/600, body-sm 13, body 14, subhead 16/600, heading 18/600, title 24/600 | Only `title` (web 11, portal 5) and `subhead` (via CardTitle) are used. `caption`/`label`/`body-sm`/`body`/`heading`: **0**. Raw: web `text-xs` 149, `text-sm` 120, `text-2xl` 3 | **DS-03 (High)**: scale exists but screens don't use it |
| **Spacing** | `tight`/`inline`/`stack`/`surface`/`shell`/`field-x`/`field-y` | web ≈33 token uses vs 319 numeric `gap-N`; `field-x`/`field-y` 0 | **DS-04 (Medium)**: partially adopted |
| **Radius** | `surface` .375rem, `inner` .125rem, `pill` 9999 | `rounded-surface` 5 uses total, `rounded-inner` 0, `rounded-pill` 4. Raw: web `rounded-sm` 27 / `md` 10 / `lg` 3 / `full` 6 / bare `rounded` 3 | **DS-05 (Medium)**: tokens unadopted; radius is effectively "whatever the class says". Button/Input/Badge themselves use `rounded-md`/`rounded-full`, not the tokens |
| **Elevation** | `resting` (= shadow-sm), `overlay` (= shadow-md) | `shadow-overlay` **0**; menus/tooltip/toast still use `shadow-md`; error pages use `shadow-sm` | Low; two levels is fine, but they're not used |
| **Fonts** | IBM Plex Sans + IBM Plex Sans Arabic, weights 400/500/600 | `font-bold` 0 (consistent) | **Good** choice for bilingual |
| **Dark mode** | None. No `darkMode` key, 0 `dark:` classes; deferred explicitly in tokens.css header | — | **DS-06 (Medium)**: the RGB-channel architecture makes it cheap to add later; a decision is needed |

### 2.3 Components (`packages/ui`)

| Component | What exists | Gaps / issues | Sev |
|---|---|---|---|
| **Button** (`button.tsx`) | variants default/outline/ghost/destructive; sizes sm h-8 / default h-9 / lg h-10; `asChild`; `isLoading` keeps width + `aria-busy`; `.focus-ring` | No `secondary`, `link`, or `icon` size (icon-only buttons hand-size). `destructive` hard-codes `text-white` (`button.tsx:32`). `rounded-md` not `rounded-surface`. Apps prefer `isPending ? t(...)` ternaries (web 27) over `isLoading` (14) | Medium |
| **Badge** (`badge.tsx`) | 7 variants on semantic tokens | No size, no dot/icon slot. `rounded-full` not `rounded-pill`. No domain wrappers (StatusBadge/PriorityBadge) | Medium |
| **Card / SectionCard** (`card.tsx`) | `elevation` flat/raised; `CardTitle as` h2–h4; `SectionCard` title + actions + headingLevel | The only component using radius/spacing/shadow tokens. Over-used as the default page building block (see VL-02) | — |
| **Alert** (`alert.tsx`) | default/destructive/success; role follows variant | No `warning`/`info` variants despite tokens; no icon/title slot | Medium |
| **Input / Textarea** | plain, `.focus-ring` | No size variants. **No `aria-invalid` styling**, even though `FormField` injects `aria-invalid`. `shadow-sm` not `shadow-resting` | Medium |
| **Select** (Radix) | popper, viewport-bounded, logical `ps-8` | No size variant; **no searchable combobox** (customer picker on create-ticket is a flat list of all customers) | High (as a gap) |
| **Checkbox, Label, Tabs, Tooltip, Popover, DropdownMenu** | Radix wrappers with focus rings, `dir`-aware | DropdownMenuItem always `ps-8` (space for a check) but there is no CheckboxItem/RadioItem, so every menu row is over-indented. Popover: 0 app uses | Low |
| **Dialog / AlertDialog / ConfirmDialog** | Radix focus trap; RTL centring via `lib/overlay.ts`; ConfirmDialog blocks dismiss while pending | **Dialog: 0 app usages** (DS-07, High). One size (`max-w-md`), no animation. Title `text-base` off-scale. Web wraps ConfirmDialog again in `web/components/confirm-dialog.tsx` | High |
| **Table** (`table.tsx`) | Auto `overflow-x-auto`; **stacks rows into cards below `sm`** via `TableCell label` | No sortable-header primitive (apps hand-roll `<button>` + SortIndicator), no selected/hover-row state, no density option. `TableHead` hidden below `sm`, so **no sorting on mobile**. Header and mobile label use `uppercase tracking-wide` (`table.tsx:89,107`), against the documented Arabic rule (`web/components/workspace/nav-items.tsx` ~169) | Medium |
| **PageHeader** | `<header>` + one `<h1 class=text-title>` + description + actions | No breadcrumb/back slot (5 hand-rolled back links). Misused (see VL-05) | Medium |
| **EmptyState / QueryStateCard / LoadingStatus / FetchingIndicator / Skeleton / RouteLoadingSkeleton / NavigationOverlay** | Comprehensive state toolkit; `role=status`, aria-hidden placeholders | Skeleton `animate-pulse` has no `motion-reduce` guard (Spinner does). Spinner: 0 app usages. Portal uses EmptyState/QueryStateCard **0** times | Medium |
| **FilterBar / FilterSelect** | Shared filter row; `renderLabel` | Hard-codes `sm:min-w-[10rem]` (repeated 16× in apps). Not used by reports, users, audit log, notifications | Medium |
| **FormField** | Injects `aria-describedby` / `aria-invalid`; hint/error; density compact/comfortable | 11 usages vs 73 + 4 hand-rolled labels | High (adoption) |
| **Pagination** | prev/next, live indicator, `rtl:rotate-180` | No page numbers / page size | Low |
| **SuccessToaster** + `lib/toast-store.ts` | success-only | No error/info toast; each app keeps a separate NotificationToaster | Medium |

**Missing generic primitives:** Avatar, Switch, RadioGroup, Combobox/Command, Sheet/Drawer, Breadcrumb/BackLink, TextLink, Separator, DescriptionList (key/value), Kbd, general Toast.

### 2.4 Icons
- lucide-react only, exported semantically through `ui/lib/icons.ts`, with documented sizing/aria/RTL rules. **Good.**
- Leaks: `checkbox.tsx:5`, `dialog.tsx:5`, `select.tsx:5` import lucide directly. Back links use the `&larr;` HTML entity (5 places) instead of an icon.
- Icons are almost absent from content. Only 4 web files and 2 portal files render icons: the nav, the toaster and the login feature list. Buttons, empty states, stat tiles, timeline rows and table actions are text-only. That contributes to the "flat forms" feel (VL-06).

---

## 3. Visual Language Assessment

**Is there a coherent identity?** There is a coherent *system*: neutrals, contrast and focus are consistent. There is no *identity*. Every screen is white cards on slate-50 with near-black buttons. The login screen (Story 175) is the one place with brand expression (gradient panel, raised card, accent rail). Once signed in, that expression disappears.

| ID | Finding | Evidence | Why it matters | Sev | Direction |
|---|---|---|---|---|---|
| VL-01 | **Monochrome accent; branding barely applied** | `--accent` = slate-900; branch `primaryColor` only on `border-b-2` (`web/components/workspace/workspace-header.tsx:190`, `portal/components/portal/portal-header.tsx:174`); `secondaryColor` unused anywhere; portal branding is fetched client-side, so it flashes; login unbranded in both apps | Product feels unfinished and generic. Primary vs. secondary actions are distinguished only by fill. Customers see no branch identity | **High** | Introduce a brand accent ramp (50–950) as tokens. Map `--accent` to it. Let branch branding override the accent token at runtime (one CSS-var write) instead of tinting a border |
| VL-02 | **Card-everything layout** | Ticket detail = 11 bordered cards (`web/components/tickets/ticket-detail-view.tsx:412-856`); `<SectionCard` ×32 web; PageHeader *inside* a Card on branches, ticket categories, KB categories (`branch-departments-view.tsx:82`, `ticket-categories-view.tsx:45`, `kb-categories-view.tsx:44`) | Equal-weight boxes flatten hierarchy; borders compete; dense screens look busy rather than organized | **High** | Reserve cards for discrete objects. Use page sections with headings, dividers and whitespace for page structure. Introduce a "panel" / "inspector" surface for side columns |
| VL-03 | **Typography doesn't express hierarchy** | Only `text-title` and `text-subhead` are used; everything else is `text-xs`/`text-sm`. 5 raw `h2 className="text-sm font-semibold"` (`reports-view.tsx:908`, `webhook-subscriptions-view.tsx:117`, `article-detail-view.tsx:473`, `notification-templates-view.tsx:164`, `change-password-section.tsx:112`) next to SectionCard's `text-subhead`. Portal home h2s are `text-sm font-semibold` (`portal-home-view.tsx:91,163,218`). KPI tiles use off-scale `text-2xl` (`dashboard-view.tsx:78`, `reports-view.tsx:479,511`) and `text-[22px]` (`report-charts.tsx:155`) | Section headings look different page to page; numbers don't pop; body text is often 12px | **High** | Adopt the existing named scale everywhere (`body` 14px as default content, `caption` for meta, `heading` for panels). Add a `display` step for KPIs |
| VL-04 | **Status semantics collide** | `web/lib/ticket-badges.ts`: OPEN = warning (amber) **and** HIGH = warning; IN_PROGRESS = LOW = MEDIUM = SLA on-hold = `secondary` grey; `info` unused; SLA has no at-risk tier (`web/lib/sla.ts` `deriveSlaStatus`); SLA-policy priority uses `outline` so URGENT isn't red (`sla-policy-list-view.tsx:191`); toaster pairs `warning` with `border-red-200` (`notification-toaster.tsx:105`) | An open high-priority ticket shows two identical amber pills; agents can't tell state from urgency at a glance | **High** | Define a CRM status vocabulary: status = hue family (open = info/blue, in progress = accent/violet, pending/on-hold = neutral, resolved = success, closed = muted); priority = intensity + icon; SLA = on-track / at-risk / breached / paused |
| VL-05 | **Page header placement inconsistent** | PageHeader inside Card (above); wrapped in sibling flex with FetchingIndicator instead of the `actions` slot (`notification-history-view.tsx:251`, `audit-log-view.tsx:125`); button outside `actions` (`sla-policy-list-view.tsx:55`); description as a separate `<p>` (`ticket-categories-view.tsx:45-47`); two h1s on Settings (`settings-view.tsx:42-58`) | Page tops jump around; no predictable "title / meta / primary action" zone | Medium | One page-header contract: title, description, meta, primary + secondary actions, optional back/breadcrumb, optional tabs |
| VL-06 | **Text-only UI; almost no iconography or avatars** | Icons are rendered in 6 files; Avatar: 0; users are names only | Scanning relies entirely on reading; the UI feels like an admin form tool | Medium | Icons in nav, buttons, empty states, timeline events, channel badges; avatars for agents and customers |
| VL-07 | **Four filter-row implementations** | `FilterBar` (tickets, customers, KB list); hand-rolled `flex flex-wrap items-end gap-2` ×3 in reports (`reports-view.tsx:591,624,677`); bare Input in users (`user-list-view.tsx:172`); free-text codes in audit log (`audit-log-view.tsx:135-151`). Search commits on blur in tickets/customers but per-keystroke in KB; search is first on customers, last on tickets | Inconsistent muscle memory; Enter doesn't search | Medium | One "list toolbar" pattern: search (submit on Enter, clear button) + filter chips/selects + saved views + result count + clear-all |
| VL-08 | **Empty/loading/error states inconsistent** | QueryStateCard in 8 web views, ~15 others hand-roll the triplet (34 `.refetch()` sites/23 files); portal uses 9 inline `<p>` empties plus a hand-copied dashed block (`notification-history-view.tsx:190`); detail-page errors are bare Alerts with no h1/back/retry (`web/customer-detail-view.tsx:526`, `web/article-detail-view.tsx:130`, `portal/ticket-detail-view.tsx:102`, `portal/article-detail-view.tsx:43`); 23 identical `loading.tsx` then a different list skeleton (two-step shift) | Feels unpolished; dead-end error pages | Medium | Mandate QueryStateCard (list) and a new `DetailErrorState` (h1 + back + retry); route skeletons shaped per page type |
| VL-09 | **Density is uniform, not purposeful** | Table rows fixed `px-3 py-2`; main `p-6` everywhere incl. 320px (`workspace-shell.tsx`); detail pages in long single columns; create forms float in `max-w-md` with no surface (`create-ticket-view.tsx:128` etc.) | Data views waste width; forms look abandoned on wide screens | Medium | Two densities: comfortable (portal, forms) and compact (agent queues/tables); responsive page padding |
| VL-10 | **Raw palette leaks** | web: `text-emerald-600` (`customer-detail-view.tsx:197`, `user-list-view.tsx:376`, ~3.8:1 at `text-xs`, fails AA), `text-amber-700` (`reports-view.tsx:537`), `border-red-200` (`notification-toaster.tsx:105`); portal: `emerald-300/50/700` (`notification-preferences-section.tsx:92`), `text-red-700` (`ticket-chat-card.tsx:94`) | Off-token colours will not follow a redesign or dark mode | Low | Replace with semantic tokens during the token phase |
| VL-11 | **Uppercase labels conflict with Arabic rule** | `table.tsx:89,107`, `dashboard-view.tsx:74`, `customer-context-panel.tsx:70,118` | `uppercase`/`tracking-wide` is meaningless in Arabic and letter-spacing breaks joining; contradicts the documented nav rule | Low | Drop `uppercase tracking-wide`; use the `label` token's weight/colour instead |

---

## 4. Agent Web Audit

Shell: `web/app/[locale]/(agent)/layout.tsx` → `web/components/workspace/workspace-shell.tsx` (navbar *or* sidebar, chosen per branch, Story 129) + `workspace-header.tsx`, with nav config in `nav-items.tsx` (`NAV_GROUPS`, 6 groups, ~20 items).

### 4.1 Shell & navigation

| | |
|---|---|
| Strongest | Single nav source (`NAV_GROUPS`) shared by navbar, sidebar and mobile menu; grouped sections; `aria-current`; collapsible sidebar rail with sr-only labels + direction-aware tooltips (`workspace-sidebar.tsx:158`); skip link |
| Weakest | Header: plain "Signed in as {name}" text + two native `<select>`s (branch, language) + "Sign out" (`workspace-header.tsx:229-276`); no avatar/user menu, no global search, no notifications bell, no "new ticket" quick action |
| Biggest UX problem | **NAV-01 (High).** All ~20 destinations, including Administration and System, are shown to every role; unauthorized users get 403 pages. This is intentional and documented (`nav-items.tsx` ~38-48: "No client-side permission gating"). The redesign should revisit it as an IA decision, not as a bug fix |
| Biggest visual inconsistency | Native selects in the header: `h-8 rounded-md`, **no `focus-ring`** (`workspace-header.tsx:233,261`), while the login switcher is `focus-ring h-9 rounded-surface` |
| Other | NAV-02 (Medium): `/branding`, `/ai-settings`, `/business-hours` are not in nav; reachable only via Settings tabs (`settings-view.tsx:44`). NAV-03 (Medium): landing route is `/tickets`, never `/dashboard`. NAV-04 (Medium): below `sm` the hamburger is a separate full-width bar under the header (`workspace-header.tsx:293`), a third stacked row. NAV-05 (Medium): no `(agent)/error.tsx`, so errors drop the whole shell. No keyboard shortcuts or command palette anywhere (grep for keydown/hotkeys found nothing in shell) |
| Priority | **P1** |

### 4.2 Login — `web/app/[locale]/(auth)/login/page.tsx`

| | |
|---|---|
| Strongest | Best screen in the product: split composition, raised Card, FormField ×2, `Button isLoading`, correct h1→h2, logical insets (`-start-24`/`-end-16`) |
| Weakest | Native locale `<select>` (`:161`); raw `fetch` |
| Biggest UX problem | No "forgot password", no show-password toggle |
| Visual inconsistency | Login is far richer than any authenticated page; brand panel unbranded (`tCommon("appName")`) |
| Priority | **P3**: preserve; use as the reference for the new visual language |

### 4.3 Dashboard — `web/components/dashboard/dashboard-view.tsx`, `tasks-panel.tsx`

| | |
|---|---|
| Strongest | Clear hierarchy: raised primary queue (`:316`) over secondary grid (`:395`) (Story 144) |
| Weakest | Only 2 KPI tiles (`StatTile`, `:63`), non-clickable, `uppercase tracking-wide` (`:74`), off-scale `text-2xl` |
| Biggest UX problem | Not the landing page; no "my queue / at-risk / unassigned" actionable summary; hand-rolled query states ×3 (`:317-350`, `:399-418`, `tasks-panel.tsx:69-87`) |
| Visual inconsistency | "My tickets" rows don't wrap (`:357`) while sibling rows do (`:135`, `tasks-panel.tsx:116`); native `datetime-local` input (`tasks-panel.tsx:234`); `toLocaleString()` without locale (`tasks-panel.tsx:130`) |
| Priority | **P2** |

### 4.4 Ticket list — `web/components/tickets/ticket-list-view.tsx`
Detailed in §6.1. The **reference implementation** for list screens (PageHeader + FilterBar + QueryStateCard + Table + Pagination + URL filters).
**Biggest problem:** raw enum filter options (TK-01, High). Priority **P1**.

### 4.5 Customers — `customer-list-view.tsx`, `customer-detail-view.tsx` (879 lines)

| | |
|---|---|
| Strongest | Detail 2/3 + 1/3 grid (`:662`); explicit name edit mode with h1 handling (`:572-620`) |
| Weakest | List shows only name/status/created (`:233-257`); no email, phone, open-ticket count, owner, last activity |
| Biggest UX problem | No customer "profile header" (identity, tier, KPIs, contacts); contacts crammed in the narrow column with fixed-width add-form (`w-36/w-40/w-32`, `:294-311`) and per-contact portal-password inputs inside rows (`:158-200`); status `Select w-32` mutates without confirmation (`:621-635`) |
| Visual inconsistency | Status filter is a hand-built Select in a label (`:178-196`), not FilterSelect; inline skeleton duplicate (`:207-213`); `<p>` empties (`:677,741,767`); `text-emerald-600` (`:197`) |
| Priority | **P2** |

### 4.6 Knowledge base — `article-list-view.tsx`, `article-detail-view.tsx`, `create-article-view.tsx`, `kb-categories-view.tsx`

| | |
|---|---|
| Strongest | List uses QueryStateCard with `noResults`; translation-status column (Story 149) |
| Weakest | **KB-01 (High):** article detail is *always* an edit form (Textarea body `:318`, en/ar Tabs `defaultValue="en"` regardless of UI locale `:280`). There is no read view for agents looking up answers |
| Biggest UX problem | No reading experience; no rich text; red destructive "Unpublish" button on every row (`:316-323`) |
| Visual inconsistency | Search is aria-label-only `Input max-w-sm` next to a labelled select; per-keystroke vs blur elsewhere; `isFiltered` ignores category (`:179`); raw `h2` for translations (`:473`) |
| Priority | **P2** |

### 4.7 Reports — `reporting/reports-view.tsx` (943 lines), `report-charts.tsx`

| | |
|---|---|
| Strongest | Token-coloured local charts (BarChart, DonutGauge, RatingBar), no chart library; saved views |
| Weakest | `ReportCard` (`:902-942`) = Card + raw `h2 text-sm`; KPI tiles off-scale |
| Biggest UX problem | **RP-01 (Medium):** one invalid date range renders the same error Alert in up to 7 cards (`:922-938`); filter state in `useState` (`:189`), not URL |
| Visual inconsistency | 3 hand-rolled filter rows; `text-amber-700` (`:537`); status bar colours hand-mirror `ticket-badges` (`report-charts.tsx:185-190`) |
| Priority | **P3** |

### 4.8 Notifications — `notification-history-view.tsx`, `notification-preferences-section.tsx`, `notification-templates-view.tsx`

| | |
|---|---|
| Strongest | Table with mobile labels; Pagination |
| Weakest | No read/unread state per row although the nav shows an unread count; event cell = `outline` Badge holding a sentence (`:100`) |
| Biggest UX problem | Preferences section placed above history (`:263`), so the main content is pushed down; no inbox model (mark read, filter, jump to ticket) |
| Visual inconsistency | PageHeader wrapped with sibling FetchingIndicator (`:251-261`); double `overflow-x-auto` (`:294`, Table already wraps) |
| Priority | **P2** (merge into a header notification centre) |

### 4.9 Admin / settings

| Screen | Finding | Sev |
|---|---|---|
| Users `users/user-list-view.tsx` | **AD-01 (High), weakest screen in the app.** Every row is a full form: inline email, password reset Input + destructive Button, full-name Input, role + department Selects, activate/unlock (`:316-515`). No detail page, no Dialog | High |
| Roles `roles/role-list-view.tsx` | Permission editor expands inside a table cell with h3 + checkbox grid (`:184-204`) | Medium |
| Branches `branches/branch-departments-view.tsx` | PageHeader (h1) inside a Card (`:82`); no h1 during load/error (`:54-71`); inline rename `min-w-[10rem]` | Medium |
| Ticket / KB categories | PageHeader inside Card; near-duplicate files | Medium |
| SLA policies `sla-policies/sla-policy-list-view.tsx` | Inline `Input w-24` target editors in cells (`:197-213`); priority as `outline` Badge; hand-rolled states | Medium |
| Business hours | No h1 in load/error (`:459-475`); fixed `w-24` weekday | Low |
| Branding `admin/branding-view.tsx` | Hex typed into text inputs, no swatch/picker (`:181-201`); native radio cards without focus ring (`:217-230`); minimal preview | Medium |
| Settings `settings/settings-view.tsx` | Tabs host other pages, giving 2 h1s (`:23`, acknowledged); tab not in URL | Medium |
| Audit log `audit-logs/audit-log-view.tsx` | Free-text internal `action`/`entityType` filters; raw UUIDs/enums rendered (`:236,243`); nested scroll `pre` | Medium |
| Create forms (`create-ticket-view.tsx:128`, `create-customer-view.tsx:50`, `create-user-view.tsx:78`, `create-sla-policy-view.tsx:82`, `create-article-view.tsx:66`) | `max-w-md` floating forms, no surface, no Cancel, no required markers, different label style (`text-sm text-ink-strong` vs `text-xs text-ink-muted`); create-ticket customer picker is a non-searchable Select of all customers (`:136-151`), a Link nested in a `<label>` (`:155`) | Medium |

**Strongest:** create-forms-in-SectionCard on API keys/webhooks/quick replies are consistent. **Biggest UX problem:** inline-in-table editing (AD-01). **Biggest visual inconsistency:** PageHeader-in-Card vs PageHeader-on-page. **Priority:** **P2** (after shell and ticket workspace).

---

## 5. Customer Portal Audit

Shell: `portal/app/[locale]/(customer)/layout.tsx` (skip link, `PortalHeader`, `<main id="main-content" class="flex-1 p-6">`), `portal/components/portal/portal-header.tsx`. Flat 5-item top nav; hamburger DropdownMenu below `sm`. RTL: 0 physical utilities. Same tokens as web.

| ID | Cross-cutting finding | Evidence | Sev |
|---|---|---|---|
| PT-01 | **No content width cap** | `<main class="flex-1 p-6">` (`(customer)/layout.tsx:42`) vs web's `max-w-screen-2xl`; KB article lines run full viewport (`article-detail-view.tsx:75`, `whitespace-pre-wrap`, no `max-w-prose`) | **High** |
| PT-02 | **Weak branch identity** | Logo + header border only; `secondaryColor` unused; branding fetched client-side (flash); login unbranded because `/portal/branding` needs auth (`apps/api/src/modules/portal/portal-branding.controller.ts`) | Medium |
| PT-03 | **Header name link = Home, with no truncation** | "Signed in as {name}" doubles as the home link with no "Home" item (`portal-header.tsx:177-183`); no `truncate`/`min-w-0`, logo uncapped (web fixed this in Story 173) | Medium |
| PT-04 | **Untranslated enums** | Priority raw (`ticket-detail-view.tsx:145`), history `eventType` raw (`:181`), toast "status: IN_PROGRESS" (`notification-toaster.tsx:116-119`) | **High** |
| PT-05 | **Primitives not adopted** | EmptyState 0, QueryStateCard 0, Select 0, `cn` 0; hand-rolled pills (`notification-history-view.tsx:212`, `notification-preferences-section.tsx:90-94` raw emerald); hand-rolled error/not-found cards ×3 with `rounded-lg shadow-sm` and a raw button (`app/[locale]/error.tsx:37-43`) | Medium |

### Per area

| Area | Strongest | Weakest | Biggest UX problem | Biggest visual inconsistency | Priority |
|---|---|---|---|---|---|
| **Login** `(auth)/login/page.tsx` | Split brand panel, raised Card, FormField, single h1 (`:186`), logical insets | Generic slate brand panel | No forgot-password/reset flow anywhere in portal; no show-password | Far richer than post-login pages | P3 (preserve) |
| **Home** `portal-home-view.tsx` | Each panel handles loading/error-retry/empty independently | Section h2s `text-sm font-semibold` (`:91,163,218`) | No primary CTA ("New ticket", "Ask assistant"); "Explore" duplicates header nav | Heading styles differ from SectionCard | **P1** |
| **Tickets list + create** `components/tickets/ticket-list-view.tsx` | FilterBar + result count (`role=status`, `:170`) + clear filters | Create form: Subject + free-text Category only (`:303-319`) | **PT-06 (High):** no description/first message, no attachment, no redirect to the new ticket (`:287-289`); free-text category vs managed categories elsewhere | `SectionCard` h2 "Create" renders before the page h1 (`:128` vs `:134`); hand-rolled labels next to FormField | **P1** |
| **Ticket detail** `ticket-detail-view.tsx`, `ticket-chat-card.tsx`, `ticket-attachments-card.tsx` | CSAT is a proper radiogroup with focus ring (`:278-307`, Story 167) | Dead-end error state: bare Alert, no h1/back/retry (`:102-107`) | Thread `max-h-80`; time without date; every OUTBOUND labelled "Agent" incl. replayed AI turns (`ticket-chat-card.tsx:85`); can reply on CLOSED tickets with no hint; CSAT buried last (`:191`) | `text-red-700` (`ticket-chat-card.tsx:94`); unstyled native file input | **P1** |
| **Knowledge base** `article-list-view.tsx`, `article-detail-view.tsx` | Complete states incl. separate empty vs no-results (`:92-115`) | Plain-text article body, no prose width | No categories browse, no "was this helpful", no "still need help? → ticket/chat" | Search aria-label-only vs visible label on tickets page | **P1** |
| **Chat** `components/chat/chat-widget.tsx` | Escalation-to-ticket exists | **Weakest portal screen:** no h1 (only SectionCard h2, `:98`); 320px-high box in a card (`max-h-80`, `:122`) | New session every mount, so navigating away loses the conversation (`:69-78`); raw backend `errorMessage` (`:150-153`); "Thinking…" plain `<p>` (`:147`); escalation without confirmation (`:161`) | Bubbles `bg-accent` slate-900; disabled notice hand-rolled `<p>` (`:156`) instead of Alert | **P1** |
| **Notifications** `notification-history-view.tsx`, `notification-preferences-section.tsx` | Table stacks on mobile | Preferences above history | Toggle is a button beside a pill, not a Switch/Checkbox (`:98-107`); raw ticket UUID fallback (`:221`) | Hand-rolled pills & dashed empty (`:190,212`); raw emerald | P2 |
| **Account** `account-view.tsx`, `change-password-section.tsx` | FormField with hint/error | Only change-password; no profile/contact/language preference | Thin | Heading style switches between form (raw `h2 text-sm`) and success (`SectionCard`) states (`:73` vs `:85-90`) | P3 |

---

## 6. Ticket Experience Audit

Files: `web/components/tickets/ticket-list-view.tsx` (460), `ticket-detail-view.tsx` (984; inlines notes, SLA, escalations, history, CSAT, properties, `AddNoteForm`, `Field`), `ticket-chat-card.tsx` (298), `ticket-ai-card.tsx` (154), `customer-context-panel.tsx` (148), `ticket-kb-references-card.tsx` (157), `components/attachments/attachments-card.tsx` (146); hooks `use-ticket-realtime.ts`, `use-agent-presence.ts`, `use-ticket-labels.ts`; libs `ticket-badges.ts`, `sla.ts`.

### 6.1 Ticket list

| ID | Finding | Evidence | Sev |
|---|---|---|---|
| TK-01 | Status/priority filter options are raw enums in both locales | `ticket-list-view.tsx:37-38,244-259` pass `STATUS_OPTIONS`/`PRIORITY_OPTIONS` with no `renderLabel` (FilterSelect falls back to the raw value, `ui/components/filter-bar.tsx:71`); `useTicketLabels` is already imported | **High** |
| TK-02 | No queue model: no "My open / Unassigned / At risk / Breached" views, no saved views, no "Me"/"Unassigned" in agent filter | `:243-287` | **High** |
| TK-03 | No SLA/priority sort although the API supports `sortBy: "slaUrgency"` (`web/lib/tickets-api.ts:159`, used by dashboard) | sort only createdAt/updatedAt (`:206-215`) | Medium |
| TK-04 | No bulk selection/actions, no realtime list refresh, no unread/last-message preview | no socket join (doc at `:120-122`) | Medium |
| TK-05 | Search commits only on blur; no Enter, clear, or icon | `:284` | Medium |
| TK-06 | Filtered empty says "no tickets" (no `isFiltered`), no clear-filters | `:300-320` | Low |
| TK-07 | Two full `toLocaleString` date columns consume width; no density toggle; no sorting on mobile (TableHead hidden below `sm`) | `:417-422`; `ui/components/table.tsx:89` | Medium |
| TK-08 | SLA cell text not localized (`formatRemaining` hard-codes `h`/`m`) | `web/lib/sla.ts:55-63` | Medium |

Good: URL-persisted filters (`useUrlFilters`), `aria-sort`, server pagination with live indicator, 8 columns after Story 158, mobile stacked cards.

### 6.2 Ticket detail — current layout

```
Back link
H1 subject [Edit]                      ← no id, status, priority, SLA, assignee, channel, actions
"Customer: <link>"
[mutation error Alert]
┌──────────── main (lg:col-span-2) ────────────┐ ┌──── side (1/3) ────┐
│ Live Chat card (thread max-h-60vh + composer)│ │ Properties (untitled│
│ AI Assist card                               │ │  card, 5 Selects)   │
│ [AI no-match Alert]                          │ │ Customer context    │
│ Notes card (+ 2nd composer, @mention)        │ │ SLA                 │
│ Attachments card                             │ │ Escalations         │
│ KB references card                           │ │ History             │
└──────────────────────────────────────────────┘ │ CSAT                │
                                                 └─────────────────────┘
Below lg: one column, main first, so Properties lands after 5 cards.
Nothing sticky. No tabs. 11 cards.
```

### 6.3 Findings

| ID | Area | Finding | Evidence | Sev |
|---|---|---|---|---|
| TW-01 | Header | No ticket number, status/priority badges, SLA, assignee, channel, timestamps or primary actions (Resolve, Assign to me, Next/Prev) in the header | `ticket-detail-view.tsx:309-385` | **Critical** (for the redesign's centrepiece) |
| TW-02 | Layout | 11 equal-weight cards; side column not sticky; below `lg` properties come after 5 cards; composer often below the fold (thread up to 60vh above it) | `:412-856`; `ticket-chat-card.tsx:114` | **High** |
| TW-03 | Conversation | Titled "Live Chat" even for email; no day separators or dates (time only, `:159-162`); no avatars, per-message channel, or message attachments; auto-scrolls to bottom on every update even when the agent scrolled up (`:81-86`) | `ticket-chat-card.tsx` | **High** |
| TW-04 | Notes | Separate card below the AI card with its own composer; no "Internal" tint/lock/badge; not interleaved with conversation; @mention dropdown lacks listbox/combobox ARIA and arrow keys (`:952-966`) | `ticket-detail-view.tsx:440-472, 879-975` | **High** |
| TW-05 | Composer | No attach, no "send and set status", no note toggle, no draft persistence, no shortcut hints; Enter-to-send has **no `isComposing` IME guard** (Arabic input can send early, `:238-243`); textarea disabled while sending; quick replies are a `sm:w-64` Select with no search or variables | `ticket-chat-card.tsx:200-298` | **High** |
| TW-06 | AI | Suggested reply cannot be inserted into composer (only CATEGORIZE has "apply", `ticket-ai-card.tsx:129-139`); result plain `<p>`, not persisted, transitions not announced | `ticket-ai-card.tsx` | **High** |
| TW-07 | Status/priority | Edited via 5 Selects in an **untitled** card (breaks heading outline); no coloured badge anywhere on the detail page; all selects disabled while any one mutates | `:491-690` | Medium |
| TW-08 | Assignment | Cannot unassign or clear category/department; no "Assign to me"; no search in the user list; presence only inside dropdown | `:556-689`, `:601-643` | Medium |
| TW-09 | SLA | Doesn't say first-response vs resolution (`responseTargetAt`/`resolutionTargetAt` collapsed by `deriveSlaStatus`); no live countdown, no at-risk tier, nothing near the top | `:694-763`; `tickets-api.ts:10-11` | **High** |
| TW-10 | Activity | History renders raw `entry.eventType` (`:822`), ignores `actorUserId`/`snapshot`; history, escalations, notes, messages are 4 separate lists | `:801-830` | **High** (i18n) |
| TW-11 | Customer context | Read-only; no tier, ticket count, lifetime CSAT; the raising contact (`ticket.contactId`) is never shown | `customer-context-panel.tsx` | Medium |
| TW-12 | Attachments | Separate card; raw `<input type=file>` in a text-less `<label>` (no accessible name, `attachments-card.tsx:134-140`); no drag-drop, multi-file, delete, preview | `attachments-card.tsx` | **High** (a11y) |
| TW-13 | KB references | Titles not links (`:69`); identical "Remove"/"Attach" labels on every row; no debounce on search; one pending flag flips every row to "Attaching…" (`:146-148`); no "insert link into reply" | `ticket-kb-references-card.tsx` | Medium |
| TW-14 | CSAT | Plain "Rating: N" text, last in side column | `:832-856` | Low |
| TW-15 | Realtime | No collision/"also viewing"/typing indicators; realtime field changes silently mutate the UI | `use-ticket-realtime.ts` | Medium |
| TW-16 | Loading | `TicketDetailSkeleton` is single-column, old order, so layout shifts on load; several doc comments still describe old order | `:170-203` | Low |
| TW-17 | Missing | No merge/split/related tickets, no manual escalate, no watchers | grep found none | (Out of scope for redesign; product backlog) |

**Does the layout support an efficient agent workflow?** Partially. Story 156 got the big split right (write on the left, read on the right). But the agent's core loop is *read latest → check context/SLA → reply or note → set status → next ticket*, and today that loop requires:
- scrolling past up to 60vh of thread to reach the composer;
- using a second composer in a different card for notes;
- re-reading status from Select text;
- scrolling the side column to SLA;
- navigating back to the list for the next ticket.

### 6.4 Suggested information architecture (not to be implemented in recon)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Ticket header (sticky)                                                        │
│ ← Back  #T-1234 · Subject (editable)            [Assign to me] [Status ▾]    │
│ [Status][Priority][SLA: 2h left ⏱ resolution][Channel][Assignee avatar]  ‹ › │
├──────────────────────────────────────────────┬────────────────────────────────┤
│ Unified timeline (role=log)                  │ Inspector (sticky, scrolls     │
│  ─ Today ─                                   │ independently)                 │
│  ◉ Customer message      (bubble, avatar)    │ ▸ Properties (status, prio,    │
│  🔒 Internal note        (tinted, badge)      │   category, dept, assignee —   │
│  · Status changed by Sara (system event)     │   combobox w/ search, "me",    │
│  ◉ Agent reply  (+attachments inline)        │   "unassigned")                │
│  ✦ AI summary (pinned, collapsible)          │ ▸ SLA (response + resolution,  │
│                                              │   at-risk tier, hold/resume)   │
│  [Filter: All · Conversation · Notes · Events]│ ▸ Customer (identity, contact  │
├──────────────────────────────────────────────┤   who raised it, open tickets, │
│ Composer (sticky bottom)                     │   CSAT history)                │
│ [Reply | Internal note]  tabs                │ ▸ AI assist (summarize,        │
│ textarea (IME-safe, draft-persisted)         │   suggest → "Insert", KB       │
│ [📎][Quick reply /][KB link][AI suggest]      │   suggestions)                 │
│                 [Send ▾ (and set Pending/    │ ▸ Knowledge base references    │
│                  Resolved)]                  │ ▸ Attachments (all files)      │
│                                              │ ▸ CSAT                         │
└──────────────────────────────────────────────┴────────────────────────────────┘
Below lg: header (sticky, compact) → segmented control [Conversation | Details]
          → composer pinned to bottom on Conversation tab.
```

Principles:
1. **Header owns state and primary actions.**
2. **One timeline** for messages, notes and system events, with filters.
3. **One composer**, with a Reply/Note mode switch; attachments, quick replies, KB and AI feed *into* it.
4. **Inspector** of collapsible sections replaces stacked cards.
5. **Sticky header and composer.**
6. **Prev/next ticket** navigation within the current queue.
7. **Keyboard shortcuts** (`r` reply, `n` note, `a` assign to me, `j`/`k` next/prev).

This needs **no API change** for 1–5. Prev/next needs the list query context; shortcuts are client-only.

---

## 7. Shared Component Audit

### 7.1 Keep as shared (solid, adopt more)
`Button`, `Input`, `Textarea`, `Label`, `Checkbox`, `Select`, `Tabs`, `Tooltip`, `DropdownMenu`, `Popover`, `Dialog`/`AlertDialog`/`ConfirmDialog`, `Table` (mobile stacking), `Pagination`, `PageHeader`, `Card`/`SectionCard`, `Alert`, `Badge`, `EmptyState`, `QueryStateCard`, `LoadingStatus`, `FetchingIndicator`, `Skeleton*`, `NavigationOverlay`, `FormField`, `FilterBar`, `SortIndicator`, `lib/icons.ts`, `lib/cn.ts`.

### 7.2 Redesign (visual/API changes)

| Component | Change | Why |
|---|---|---|
| Button | add `secondary`, `link`, `icon` size; tokenized radius; brand accent | Icon-only buttons hand-sized; no visual tier between primary and outline |
| Badge | sizes, dot/icon slot, `rounded-pill` | Status semantics (VL-04) need icon + colour, not colour alone |
| Alert | `warning`/`info`, icon + title slots | Tokens exist; apps fake them |
| Input/Textarea/Select | sizes; `aria-invalid` styling; leading/trailing icon (search) | FormField already sets `aria-invalid` but nothing renders it |
| Table | sortable header primitive, row hover/selected, density, mobile sort control, drop `uppercase` | Hand-rolled sort buttons; no bulk selection; mobile can't sort |
| Dialog | sizes (sm/md/lg/xl), enter/exit motion (with `motion-reduce`), on-scale title | Needed to move admin editing out of table cells |
| PageHeader | back/breadcrumb slot, meta slot, tabs slot | 5 back links hand-rolled; 6 misplacement patterns |
| SuccessToaster → Toast | variants (success/info/warning/error), 320px-safe width, region always mounted | Toast clipped at 320px (`fixed end-4 w-full max-w-sm`); first announcement can be missed |
| Skeleton | `motion-reduce:animate-none` | Pulse ignores reduced-motion |

### 7.3 Consolidate (duplicates across apps)

| Duplicate | Copies | Target |
|---|---|---|
| Locale switcher (`LOCALES` + native `<select>`) | 4: `web/…/login/page.tsx:62`, `workspace-header.tsx:30`, `portal/…/login/page.tsx:61`, `portal-header.tsx:27` (different heights, 3 lack focus ring) | `LocaleSwitcher` (generic, labels via props) |
| Error / not-found card | 3 portal + web twins (`app/[locale]/error.tsx`, `not-found.tsx`, `app/not-found.tsx`) | `ErrorState` / `DetailErrorState` |
| Detail-page skeletons | web ×3, portal ×2, plus `ListSkeleton`, `ReportCardSkeleton` | Skeleton recipes (list, detail-2col, form) |
| `lib/fonts.ts`, `lib/ticket-badges.ts`, `lib/notifications-store.ts`, NavigationOverlayListener (≈8 differing lines), NotificationToaster, AuthRecoveryListener, QueryProvider, ChangePasswordSection, NotificationPreferencesSection, AttachmentsCard ↔ TicketAttachmentsCard | 2 each (web/portal) | Move to `@crm/ui` (generic) or a new shared CRM package (domain) |
| SuccessToaster wrappers | `web/components/ui/success-toaster.tsx`, `portal/components/portal/success-toaster.tsx` | Use `@crm/ui` directly |
| `ConfirmDialog` wrapper | `web/components/confirm-dialog.tsx` over `@crm/ui` | Fold into the primitive |

### 7.4 Repeated local patterns → future primitives

**Generic UI primitives** (domain-free, belong in `@crm/ui`):

| Primitive | Evidence of need |
|---|---|
| `Avatar` (+ presence dot) | 0 today; users are names only; presence is a Badge inside a Select |
| `Combobox` / `Command` (searchable select, mention list) | Create-ticket customer picker, assignee picker, @mention (`ticket-detail-view.tsx:952-966`, no ARIA) |
| `Sheet` / `Drawer` | Mobile nav, ticket inspector below `lg`, admin edit panels |
| `Switch` | Portal notification preferences toggle (`notification-preferences-section.tsx:98-107`), feature flags |
| `RadioGroup` / `RadioCard` | Branding layout radios (`branding-view.tsx:217`), CSAT |
| `BackLink` / `Breadcrumb` | 5 hand-rolled `&larr;` links |
| `TextLink` | ~25 `focus-ring rounded-sm hover:underline` sites |
| `DescriptionList` (key/value) | `Field` (`ticket-detail-view.tsx:977`), portal `<dl>` (`ticket-detail-view.tsx:131`) |
| `StatCard` / KPI | `StatTile` (`dashboard-view.tsx:63`) + 2 inline in reports |
| `Timeline` / `ActivityList` | ~15 copies of `ol flex flex-col gap-2` + `li border-b border-rule-subtle pb-2` |
| `FileDropzone` / `FileInput` | 2 raw unlabeled file inputs |
| `ListToolbar` (search + filters + count + clear) | 4 filter-row implementations (VL-07) |
| `Kbd` | For shortcut hints |
| `Separator` | Dividers hand-rolled with borders |

**CRM-specific patterns** (domain-aware; *not* in `@crm/ui`, which is deliberately domain-free; suggest a shared `packages/crm-ui` or app-level `components/patterns`):

| Pattern | Evidence |
|---|---|
| `TicketStatusBadge` / `TicketPriorityBadge` (single semantic map) | 2 map copies + `report-charts.tsx:185-190` mirror; 8 + 6 call sites |
| `SlaIndicator` (on-track / at-risk / breached / paused; response vs resolution; localized duration) | `SlaCell` (`ticket-list-view.tsx:96`), `SlaPresentation` (`dashboard-view.tsx:84`), inline detail (`:700-720`) |
| `ActiveBadge` (active/inactive, verified, succeeded) | 11 `x.isActive ? "success" : "secondary"` sites |
| `MessageThread` + `MessageBubble` + `Composer` | 3 near-identical copies (web ticket chat, portal ticket chat, portal AI chat) |
| `TicketHeader`, `TicketInspector`, `UnifiedTimeline` | New, per §6.4 |
| `CustomerCard` / `CustomerSummary` | Context panel + customer detail |
| `UserPicker` (avatar + presence + "me"/"unassigned") | Assignee Select, agent filter, mention |
| `EntityHeader` (detail-page header: identity + meta + actions) | Ticket, customer, KB article, user |
| `NotificationItem` / inbox row | Web + portal history tables |
| `DateTime` / `RelativeTime` (Intl, locale-aware) | 23 web + 6 portal inline `toLocale*String`, 4 without locale; `docs/architecture/10-i18n-and-rtl.md:18` mandates Intl formatters |

---

## 8. Responsive / RTL / LTR Audit

### 8.1 What's right (verified)
- `<html lang dir>` set from locale in both `[locale]/layout.tsx`; portal `app/not-found.tsx` derives `dir` from cookie.
- **0 physical-direction utilities** (`ml-/mr-/pl-/pr-/left-/right-/text-left/right/border-l/r/rounded-l/r/space-x`) in `apps/web/src`, `apps/portal/src`, `packages/ui/src` (non-comment). Logical utilities used: `border-s-2`, `border-e`, `-ms-4 me-4`, `end-4`, `start-2`, `ps-8 pe-2`, `text-start/end`, `-start-24/-end-16`.
- Directional glyphs flip with `rtl:rotate-180` (web 8, portal 4); Dialog centring uses `start-1/2` + `rtl:translate-x-1/2` (`ui/lib/overlay.ts:35`); sidebar tooltip side derived from direction.
- `Table` stacks to cards below `sm` with per-cell labels (Stories 150/RM-10); Story 173/174 hardened the header and fixed-width form controls for 320px.

### 8.2 Findings

| ID | Finding | Evidence | Sev | Direction |
|---|---|---|---|---|
| RS-01 | Toasts overflow at 320px | `fixed end-4 w-full max-w-sm` in `ui/components/success-toaster.tsx:36`, `web/…/notification-toaster.tsx:94`, `portal/…/notification-toaster.tsx:62` | Medium | `inset-x-4 sm:inset-x-auto sm:end-4 sm:w-96` |
| RS-02 | Ticket workspace below `lg`: properties after 5 cards; no sticky composer; thread `max-h-[60vh]` nested scroll on phones | §6.3 TW-02 | **High** | Segmented Conversation/Details + sticky composer |
| RS-03 | No sorting on mobile tables | `ui/components/table.tsx:89` hides TableHead | Medium | Sort control in the list toolbar |
| RS-04 | Mobile shell crowding: header + reconnect banner + separate hamburger row; `p-6` main at 320px leaves 272px | `workspace-header.tsx:293`; `workspace-shell.tsx`; portal `(customer)/layout.tsx:42` | Medium | Hamburger in the header row; `p-4 sm:p-6` |
| RS-05 | Non-wrapping rows | `dashboard-view.tsx:357`, `customer-detail-view.tsx:684`; portal attachment rows w/o `min-w-0`/`break-words` (`ticket-attachments-card.tsx:58-71`) | Medium | Shared list-row pattern that stacks below `sm` |
| RS-06 | Portal header name link and logo unbounded at 320px | `portal-header.tsx:179-181` | Medium | Port web's Story 173 treatment |
| RS-07 | Fixed widths in admin/customer forms | `w-36/w-40/w-32` (`customer-detail-view.tsx:294-311`), `w-24` (`sla-policy-list-view.tsx:197-213`, `business-hours-view.tsx:102`), `sm:w-64` quick replies, `w-56` mention list, `min-w-[10rem]` ×16 | Low | Mostly mitigated by `sm:` prefixes; resolved by moving edits to Dialog/Sheet |
| RS-08 | Nested horizontal scroll | Double `overflow-x-auto` (`notification-history-view.tsx:294`, `audit-log-view.tsx:207`); `pre max-w-xs overflow-x-auto` diff inside the table (`audit-log-view.tsx:29`) | Low | Remove outer wrappers; diff in a Sheet |
| RTL-01 | Untranslated enums/units render Latin inside Arabic UI | TK-01, TW-10, PT-04, TK-08 (`2h 15m`) | **High** | Localize all enums and durations through Intl/i18n |
| RTL-02 | Locale-less dates follow the browser, not the UI | `tasks-panel.tsx:130`, `api-keys-view.tsx:152`, `webhook-subscriptions-view.tsx:166,355` | Low | Shared `DateTime` |
| RTL-03 | `uppercase tracking-wide` on Arabic text | VL-11 | Low | Remove |
| RTL-04 | KB editor tabs default to `en` regardless of UI locale | `article-detail-view.tsx:280` | Low | Default to UI locale |
| RTL-05 | Mention list `absolute top-full` with no inline anchor | `ticket-detail-view.tsx:953` | Low | Use Popover/Combobox (Radix handles `dir`) |
| RTL-06 | Docs drift: `10-i18n-and-rtl.md:14` says icons flip via a `[dir=rtl]` rule; code uses `rtl:rotate-180` | — | Low | Update doc in the redesign track |
| RTL-07 | Native file input "Choose file" text follows browser language, not UI locale | `attachments-card.tsx:135`, `ticket-attachments-card.tsx:108` | Medium | `FileDropzone` primitive |

**Not verified in a browser.** These findings are derived from class names and code paths. A Phase 0 task should capture 320/768/1280 × en/ar screenshots of ~12 representative screens as the visual baseline.

---

## 9. Accessibility Audit

### 9.1 Infrastructure that works (verified)
- Skip link in both shells (`.skip-link`, logical `start-4`).
- `.focus-ring` / `.focus-ring-always` tokens; Button/Input/Select/Checkbox/Tabs/menu items carry them; menu items got a contrast fix (Story 166).
- `FormField` wires `aria-describedby` + `aria-invalid` (Story `form-field-accessibility`).
- `Alert` role follows variant; `LoadingStatus` `role=status`; `FetchingIndicator` polite; Skeletons `aria-hidden` (Stories 161/162/165).
- `PageHeader` guarantees one `<h1>`; `CardTitle`/`SectionCard` take explicit heading levels (Story 154).
- Radix supplies dialog focus traps, roving focus and `dir`-aware arrow keys. ConfirmDialog blocks dismiss while pending and restores focus.
- Portal CSAT is a correct ARIA radiogroup (Story 167). `Button isLoading` keeps its accessible name (Story 169).
- Table sorting uses `aria-sort`. Pagination is a labelled `nav` with a live indicator.
- All icon-only buttons found are labelled (hamburger, sidebar toggle, toaster dismiss).

### 9.2 Findings

| ID | Finding | Evidence | Sev |
|---|---|---|---|
| A11Y-01 | Conversation threads are not live regions; new messages are not announced | No `role="log"`/`aria-live`: web `ticket-chat-card.tsx:104-115`, portal `ticket-chat-card.tsx:65-68`, `chat-widget.tsx:119-123`; "Thinking…" plain `<p>` (`chat-widget.tsx:147`) | **High** |
| A11Y-02 | File inputs have no accessible name | `<label>` with no text around native input: `web/components/attachments/attachments-card.tsx:134-140`, `portal/components/tickets/ticket-attachments-card.tsx:107-114` | **High** |
| A11Y-03 | Pages/states without `<h1>` | Portal chat (`chat-widget.tsx:98`); load/error states of web customer detail (`:518-530`), KB detail (`:122-134`), business hours (`:459-475`), branches (`:54-71`); portal ticket & KB detail error states | **High** |
| A11Y-04 | Heading order / duplicates | Portal tickets: h2 "Create" before h1 (`ticket-list-view.tsx:128` vs `:134`); Settings: 2 h1s (`settings-view.tsx:23`); ticket Properties card untitled; branches h1 inside a Card | Medium |
| A11Y-05 | Composite widgets without ARIA patterns | @mention list: no listbox/option, `aria-expanded`, `aria-activedescendant`, arrow keys (`ticket-detail-view.tsx:952-966`) | Medium |
| A11Y-06 | Repeated non-unique control names | "Attach", "Remove" per KB row (`ticket-kb-references-card.tsx:70-78,146`), "View all" (`customer-context-panel.tsx`) | Medium |
| A11Y-07 | ~37 inline error messages not announced | `className="…text-danger-foreground"` without role, e.g. `branding-view.tsx:189`, `api-keys-view.tsx:173`, `automation-rules-view.tsx:263`, `branch-departments-view.tsx:161`; portal preference row error (`notification-preferences-section.tsx:86-116`) | Medium |
| A11Y-08 | Missing focus ring | Header native selects (`workspace-header.tsx:233,261`, `portal-header.tsx:236`); branding radios (`branding-view.tsx:217-230`); portal back links (`ticket-detail-view.tsx:118`, `article-detail-view.tsx:59`) and home link (`portal-header.tsx:181`); not-found links | Medium |
| A11Y-09 | Placeholder used as accessible name; focus lost after send | Chat/notes textareas `aria-label={placeholder}` (web `ticket-chat-card.tsx:275`, `ticket-detail-view.tsx:940`, portal `ticket-chat-card.tsx:160`); textarea `disabled` while sending, which drops focus (portal `:159`, `chat-widget.tsx:232`, web `:274`) | Medium |
| A11Y-10 | Toast region mounted only when non-empty, so the first message may be missed | `portal/…/notification-toaster.tsx:54-56`, web `notification-toaster.tsx:86-88` | Medium |
| A11Y-11 | Navbar group trigger `aria-label` masks the unread count Badge | `workspace-navbar.tsx:477`; portal badge aria-label on a generic span (`portal-header.tsx:202,225`) | Low |
| A11Y-12 | Colour contrast | `text-emerald-600` at `text-xs` ≈3.8:1 (`customer-detail-view.tsx:197`, `user-list-view.tsx:376`) | Medium |
| A11Y-13 | Status conveyed by colour only | Badges have text, but SLA on-track is plain text and breach is colour + word; no icon redundancy | Low |
| A11Y-14 | Reduced motion | `Skeleton` `animate-pulse` without `motion-reduce` | Low |
| A11Y-15 | Clickable table rows are mouse-only | `onClick` rows in ticket list `:363`, customer list `:264`, dashboard `:138,357` (acceptable because an inner Link exists; keep that invariant) | Low |

---

## 10. Existing Strengths (preserve these)

1. **Token architecture** (`packages/config/tailwind-tokens.css`, `tailwind-preset.js`). Semantic, RGB-channel (alpha-capable), AA-documented neutrals, full status families, centralized for both apps. Re-skinning and dark mode are mostly token edits.
2. **`@crm/ui` exists, is shared by both apps, is domain-free, and every component has a spec.** web: 79/123 `.tsx` files import it; portal: 25/44. No raw `<table>` and no raw `<textarea>` in either app.
3. **RTL correctness.** 0 physical-direction utilities; logical properties throughout; `rtl:rotate-180`; Radix `dir` inheritance; direction-aware overlay centring; `lang`/`dir` on `<html>`; bilingual IBM Plex Sans + Plex Sans Arabic.
4. **Accessibility infrastructure** (§9.1): skip links, focus tokens, FormField ARIA wiring, live loading states, heading-level-aware cards, ConfirmDialog semantics, CSAT radiogroup. These came from a long series of a11y Stories (161–169).
5. **State toolkit:** `QueryStateCard`, `EmptyState`, `LoadingStatus`, `FetchingIndicator`, `Skeleton*`, `NavigationOverlay`. Where adopted (ticket list, customers, KB list, users, roles) states are consistent and announced.
6. **Responsive tables** that stack into labelled cards below `sm`; header and form controls already hardened for 320px (Stories 173/174).
7. **Navigation model:** a single `NAV_GROUPS` source with three presentations (navbar, sidebar, mobile menu) and per-branch layout choice (Story 129).
8. **Ticket list fundamentals:** URL-persisted filters, server sort/pagination, `aria-sort`, 8-column density (Story 158).
9. **Ticket workspace split** (Story 156): write-left/read-right at `lg`, visible editable h1 with Escape-to-cancel and focus restore.
10. **Login screens** (Story 175): the best visual reference in the product; proves the token system can carry a modern look.
11. **Icon governance:** semantic re-exports with documented sizing/aria/RTL rules.
12. **Guard tests** (e.g. `apps/web/src/test/tailwind-content.spec.ts`, Card/Alert regression guards cited in `design-system-foundation/00-overview.md`) protect against style drift. They should be extended, not removed, by the redesign.

---

## 11. Top UX/UI Problems (ranked)

| # | Problem | IDs | Sev |
|---|---|---|---|
| 1 | Ticket workspace lacks a state/action header, unified timeline, single composer and sticky inspector | TW-01, TW-02, TW-04, TW-05, TW-09 | **Critical** |
| 2 | No visual identity: slate-900 accent, branding only tints a border, no dark-mode decision | VL-01, DS-01, DS-06, PT-02 | **High** |
| 3 | Status/priority/SLA semantics collide and are duplicated (3 SLA renderings, 2+1 badge maps, no at-risk tier) | VL-04, TW-09, TK-08 | **High** |
| 4 | i18n leaks in core flows (raw enums in filters, history, portal priority, toasts, SLA units) | TK-01, TW-10, PT-04, RTL-01 | **High** |
| 5 | Card-everything layout and an under-used type scale give flat hierarchy | VL-02, VL-03, DS-03 | **High** |
| 6 | Admin editing lives inside table cells; Dialog/Sheet unused | AD-01, DS-07 | **High** |
| 7 | Chat/conversation accessibility: no live regions, unlabeled file inputs, missing h1s | A11Y-01/02/03 | **High** |
| 8 | Portal: no width cap, thin ticket creation, chat loses session, dead-end errors | PT-01, PT-06, chat row in §5 | **High** |
| 9 | No ticket queue model (my/unassigned/at-risk views, SLA sort, bulk actions) | TK-02, TK-03, TK-04 | **High** |
| 10 | Navigation shows every admin screen to every role; no global search, user menu or command palette | NAV-01, §4.1 | **High** |
| 11 | Primitive under-adoption: FormField, QueryStateCard, FilterBar, EmptyState (portal), named scales | DS-03/04/05, VL-07, VL-08 | Medium |
| 12 | Duplicated CRM patterns across apps (thread, composer, locale switcher, error cards, toasters) | §7.3, §7.4 | Medium |
| 13 | KB has no read mode for agents; portal KB article is plain text at full width | KB-01, PT-01 | Medium–High |
| 14 | Mobile polish: toasts clip at 320px, no mobile sort, crowded shell header, non-wrapping rows | RS-01, RS-03, RS-04, RS-05 | Medium |

---

## 12. Recommended Redesign Priorities

1. **Design direction first (decision, not code).** Brand accent ramp; neutral ramp; radius language (today .375rem; consider .5rem surfaces / .375rem controls); elevation; density modes (comfortable portal, compact agent); dark mode (yes/no/later; the token architecture supports either); icon usage policy. Record it as an ADR-style doc in `docs/architecture/` so later Stories cite it. *Needs product/brand input:* the brand hue and whether branch branding may override the accent.
2. **Token v2 on the existing token files.** No new system. Wire the accent ramp; map or remove the dead shadcn aliases (DS-02); add `display` text size; make `Button`/`Input`/`Badge`/`Card` consume `rounded-*`/`shadow-*` tokens; fix raw palette leaks (VL-10). Re-skinning then cascades through `@crm/ui` with zero screen edits.
3. **Fix i18n leaks and status semantics.** Small, high-value, unblocks credible screenshots: TK-01, TW-10, PT-04, TK-08, plus one `TicketStatusBadge`/`TicketPriorityBadge`/`SlaIndicator` with a non-colliding vocabulary (VL-04).
4. **App shell v2.** Header with user menu (avatar, language, branch, sign out), notifications bell, global search entry and "New ticket"; mobile menu in the header row; permission-aware nav *if* product approves (NAV-01); `(agent)/error.tsx` inside the shell; responsive page padding; content width caps for portal.
5. **Ticket workspace v2** (§6.4). The centrepiece. Ticket header, unified timeline, single composer with Reply/Note, sticky inspector, mobile segmented view, AI insert, attachments in composer, live region. Strictly presentation + client state; no API changes.
6. **Ticket queue v2.** Quick views, SLA sort (API already exists), localized filters, list toolbar, density, mobile sort, optional bulk select.
7. **Shared primitives wave.** Avatar, Combobox, Sheet, Switch, BackLink, DescriptionList, StatCard, Timeline, FileDropzone, ListToolbar, Toast v2, Dialog sizes. Then the CRM patterns (§7.4).
8. **Admin pattern:** list + Sheet/Dialog editor, replacing inline-cell forms (users first).
9. **Portal v2:** home with CTAs, full ticket creation (description + attachment + managed category + redirect), conversation pattern shared with web, persistent chat session UI, KB reading layout + "still need help", forgot-password (needs API; see §14).
10. **Secondary screens:** dashboard KPIs as landing, customer profile header, KB read mode, reports filter/URL state, notifications inbox.

---

## 13. Suggested Redesign Phases

Each phase is a sequence of small, independently shippable Stories (one commit each, per `CLAUDE.md` §6), verified with the existing test suites plus visual baselines.

| Phase | Goal | Representative Stories | Depends on | Risk |
|---|---|---|---|---|
| **0. Direction & baseline** | Decide the visual language; capture current state | Design-direction doc; screenshot baseline (12 screens × 320/768/1280 × en/ar); extend guard tests for raw palette classes and physical-direction utilities | — | Low |
| **1. Foundations** | Token v2 + primitive restyle; no layout change | Accent ramp + branch override; map/remove shadcn aliases; tokenized radius/shadow in primitives; Button `secondary`/`link`/`icon`; Badge dot/icon; Alert warning/info; Input invalid state; Skeleton reduced motion; Toast v2 (320px-safe, always-mounted region); replace raw palette leaks | 0 | Low–Medium (global visual change; protected by guard tests) |
| **2. Semantics & i18n** | Correct, localized status language | `TicketStatusBadge`/`TicketPriorityBadge`/`SlaIndicator` (single map, at-risk tier, localized duration); localize filters, history events, portal priority, toast status; shared `DateTime` | 1 | Low |
| **3. Shell & navigation** | Modern frame for every page | Header v2 (user menu, bell, search entry, new ticket); mobile header; agent `error.tsx`; page padding/width; PageHeader v2 (back/meta/tabs) and its consistent placement; nav IA review (permission-aware visibility is a product decision) | 1 | Medium |
| **4. Ticket workspace** | The centrepiece | TicketHeader; Inspector (sticky, collapsible); UnifiedTimeline (role=log, day separators, notes tinted); Composer v2 (Reply/Note, attachments, quick replies, AI insert, IME guard, draft); mobile segmented layout; matching skeleton | 2, 3; primitives Avatar/Combobox/FileDropzone | **High** (most-used screen; e2e specs touch it). Ship behind incremental Stories that keep every section present (Story 156's guard-test approach) |
| **5. Queues & lists** | Efficient triage | ListToolbar; quick views; SLA sort; density; mobile sort; consistent filtered-empty; optional bulk select | 2, 3 | Medium |
| **6. Shared patterns & admin** | Remove in-cell editing; consolidate duplicates | Sheet/Dialog editors (users → SLA → roles → branches → categories); FormField + QueryStateCard sweep; LocaleSwitcher, ErrorState, MessageThread consolidation | 1, 3 | Medium |
| **7. Portal experience** | Customer-grade polish | Home CTAs; ticket creation v2; shared conversation; chat page layout + session resume UI; KB reading layout + deflection CTAs; width cap; branding on header/accent | 1–3, 6 (MessageThread) | Medium |
| **8. Secondary screens** | Finish the surface | Dashboard as landing + StatCard; customer profile header; KB agent read mode; reports (single error, URL filters, StatCard); notifications inbox | 3, 6 | Low–Medium |
| **9. Dark mode (optional)** | If chosen in Phase 0 | Second `:root` token block + toggle | 1 | Low (architecture ready) |

---

## 14. Explicit Out-of-Scope Items for the Redesign Track

The redesign track is **presentation, IA, interaction and accessibility**. It does not include:

1. **API / schema / permission-model changes.** Includes merge/split/related tickets, manual escalation, watchers, collision detection backend, chat message pagination (`listForTicket` unbounded), persisting AI results, ticket `contactId` exposure beyond what the API already returns.
2. **Forgot-password / password-reset flows** (web and portal). These need new auth endpoints (reset-token issue/verify/consume) plus a reset email. An SMTP `EmailAdapter` already exists in `apps/worker/src/channels/` (`SMTP_HOST`/`SMTP_FROM` presence-checked in `apps/api/src/common/config/env.validation.ts`), so delivery is not the blocker; the backend flow is. Track as an Identity/Portal product Story, not a redesign Story. The redesign only reserves the UI slot (a "Forgot password?" link) once that Story exists.
3. **Pre-auth portal branding.** `/portal/branding` requires auth today (`apps/api/src/modules/portal/portal-branding.controller.ts`); public branding is an API decision.
4. **Permission-gated navigation** as a *behaviour* change. Today's ungated nav is a documented decision (`nav-items.tsx`, Stories 44/129). The redesign may *propose* it; implementing it needs explicit product sign-off.
5. **Rich-text editing / rendering for KB and messages** (editor library choice, sanitization, storage format).
6. **Chart library adoption.** Keep the token-coloured local charts unless reporting requirements change.
7. **New channels** (email/WhatsApp/SMS UI) beyond presenting existing channel data. Blocked on provider decisions (`CLAUDE.md` §2).
8. **Routing changes.** URLs, route groups and locale prefixes stay as they are. Renaming/merging routes (e.g. Settings tabs vs `/branding`) needs its own decision.
9. **Changing business behaviour** of any existing flow (status transitions, SLA computation, AI feature flags, CSAT rules).
10. **Storybook / documentation site.** Useful, but a tooling decision separate from the redesign itself.
11. **Fixing the pre-existing `identity.e2e-spec.ts` isolation defects** (`CLAUDE.md` §5/§13).
12. **Mobile native apps / PWA.**
