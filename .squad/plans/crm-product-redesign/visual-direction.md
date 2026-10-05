# crm-product-redesign — visual direction and design principles

Companion to [`00-overview.md`](./00-overview.md). This replaces the "calm, precise operations tool" brief in [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) §2 as the **target look**. The token architecture built in Stories 178–200 is kept unchanged, and this direction is reached through it: the CSS-variable families, the dark mode and the branch-branding tiers all stay.

Status: **approved 2026-10-05** (decisions in `00-overview.md` §9; accent: indigo, PD-1).

---

## 1. The brief in one line

**"Wow on first impression, comfortable after eight hours."** The product should look composed and confident at a glance, and become quiet once the agent is working.

## 2. Design principles

1. **Workflow first, decoration never.** Every visual element must help someone triage, read, decide or act. If removing an element costs nothing, remove it.
2. **One signature, used consistently.** Personality comes from a few recognisable decisions applied everywhere, not from effects. The decisions are: the ink navigation chrome, the status spine, the tabular numerals and the crisp hairlines (§3).
3. **Hierarchy through weight and space, not size.** The type scale stays modest. Emphasis comes from weight, ink strength and whitespace; nothing is oversized.
4. **Colour carries meaning, so it is scarce.** Neutral surfaces carry about 90% of the UI. Accent colour means "you can act here". Status colours mean the ticket's state. Priority colours mean urgency. The three never trade roles.
5. **Borders before shadows.** Resting surfaces are separated by hairlines and tone. Shadow is reserved for things that float above the page: a dragged card, menus, sheets and dialogs.
6. **Motion explains change.** A card lifts when grabbed, settles when dropped, and counts tick when they change. There are no entrance animations on page load, no parallax, and nothing that loops. Everything respects `prefers-reduced-motion`.
7. **Dense where people scan, airy where people read.** Boards and lists are compact. The conversation, the knowledge base and the portal get reading measure and line height.
8. **Bilingual by construction.** Every layout is designed with logical directions and tested in Arabic at the same time as English. Arabic is never a mirror applied afterwards.
9. **States are designed, not defaulted.** Loading, empty, error, offline and "no permission" states each get a purposeful layout that uses the same vocabulary.
10. **Accessible by default.** Accessibility means 4.5:1 text contrast, visible focus in both themes, named controls and a keyboard path for every pointer interaction, including drag and drop. It is part of every Story's definition of done, not something added at the end.

## 3. Signature elements (what makes it memorable)

| Element | Description | Where |
|---|---|---|
| **Ink chrome** | A deep ink-navy navigation rail and header band in both light and dark mode (new `chrome` token family). Content sits on a warm paper canvas beside it. The contrast between dark chrome and calm canvas is the product's silhouette. | Agent shell; the portal uses a lighter variant (§6). |
| **Status spine** | Each status owns one hue and one icon, used identically everywhere: a 3px spine at the top of each Kanban column, the column header dot, badges, timeline status events, and the dashboard distribution bar. | Board, badges, dashboard, ticket header. |
| **Urgency edge** | HIGH and URGENT tickets get a 3px inline-start edge on their card in the warning or danger tone, with the priority icon and label. Everything else is neutral, so urgency stands out because it is rare. | Kanban cards, list rows (inline-start cell border). |
| **Tabular numerals and quiet data** | Every count, time and KPI uses `tabular-nums` and the `display`/`title` scale, with the unit in `ink-muted`. Numbers align and never jump. | Column counts, StatCards, SLA timers. |
| **Hairline precision** | 1px `rule-subtle` separators, a 12px surface radius and a 8px control radius. A consistent inner grid gives a "precision instrument" feel instead of soft blobs. | All surfaces. |
| **Avatar presence** | Agents are always shown as an avatar (initials, a deterministic tone from the existing `Avatar`) with a presence dot, so people stay recognisable across the board, the ticket and the dashboard. | Cards, header, assignee picker. |

Explicitly avoided:
- gradients on functional surfaces (the login brand panel is the only place a brand gradient may appear);
- glassmorphism and backdrop blur, except the existing overlay scrim;
- coloured drop shadows and neon glows;
- emoji or 3D illustration;
- oversized hero type;
- "AI sparkle" decoration beyond the single AI-summary icon.

## 4. Colour

The token families are unchanged (surface, ink, rule, accent, semantic, progress, brand). This direction makes four changes:

1. **Canvas and surfaces.**
   - Light mode: canvas `surface-sunk` moves to a warm paper neutral (≈ `#F6F5F2`), while cards stay pure `surface` (`#FFFFFF`).
   - Dark mode keeps the current cool slate.
   - The warmth is subtle (chroma ≤ 0.01). It reads as "paper", not as "beige".
2. **New `chrome` family** for the navigation rail and header band:
   - `chrome` ≈ `#0E1726` (light and dark)
   - `chrome-raised` (hover)
   - `chrome-ink` (≥ 12:1 on chrome)
   - `chrome-muted` (≥ 4.5:1)
   - `chrome-active` (the accent at a lighter step, ≥ 3:1 against chrome)
   - `chrome-rule`

   Branch Tier 1 brand colour shows as the active-item bar and a 2px top stripe on the chrome, as it does today on the header.
3. **Accent.** **Indigo is kept** (PD-1, approved; it is also D1 of the foundation track, and the Tier 2 branding derivation is tuned to it). The ink chrome and status spine carry the identity, not the hue.
4. **Status hues** stay as approved in RD-1.14: OPEN info, IN_PROGRESS progress, RESOLVED success, CLOSED neutral. Each gets an explicit `spine` use and is checked for 3:1 non-text contrast against `surface` and `surface-sunk` in both themes.

**Data-visualisation palette** (new tokens `viz-1…viz-6`, plus the status hues for status-encoded charts):
- categorical, colour-blind-safe (no red/green adjacency), with light and dark variants;
- never branded;
- every chart pairs colour with a label or pattern.

## 5. Typography, spacing, shape, elevation, motion

**Typography.** IBM Plex Sans and IBM Plex Sans Arabic stay. They are an unusually good Latin/Arabic pairing and a real differentiator.
- The named scale stays.
- Board and list text uses `body-sm` (13/20).
- Reading surfaces use `body-lg`.
- Headings use weight 600, with no all-caps anywhere (Arabic has no case).

**Spacing.** The existing semantic spacing scale stays. Boards use `gap-stack` between cards and `p-3` inside cards.

**Radius.**
- `rounded-surface` (12px): cards, columns, sheets.
- `rounded-control` (8px): controls.
- `rounded-inner` (6px): chips and inner blocks.
- `rounded-pill`: counts, avatars and status dots only.

**Elevation.** There are four levels and no others:

| Level | Treatment | Used for |
|---|---|---|
| 0 | flat on canvas | — |
| 1 | `surface` + hairline | cards, columns |
| 2 | `shadow-raised` | hover on draggable cards only |
| 3 | `shadow-overlay` | dragged card, menus, popovers, sheets, dialogs |

**Motion.** Existing tokens: fast 120ms, base 180ms, slow 240ms, standard easing. The new uses:
- card lift: scale 1.02 and level 3 over 120ms;
- drop settle: 180ms;
- column-count tick: crossfade 120ms;
- sheet: slide in 240ms from inline-end.

Nothing else animates. Reduced motion removes the transforms and keeps the opacity changes.

**Iconography.** lucide-react stays, through the `@crm/ui` role-named icon vocabulary. The default size is 16px, nav uses 20px, and the stroke stays at 1.75. Every icon is either decorative (`aria-hidden`) with a text label, or the control has an `aria-label`.

## 6. Surface-specific direction

| Surface | Direction |
|---|---|
| **Login (agent and portal)** | Split layout. The form side is a calm canvas with a single card. The brand panel uses the ink chrome with a restrained brand-gradient wash (the one sanctioned gradient), the product name and three value statements with icons. Arabic uses the correct Plex Arabic weights (fixes the RD-1.4 fallback). Dark mode uses the same ink panel, not a bright one. |
| **Agent shell** | The ink rail (expanded 240px, collapsed 64px) holds grouped nav, the branch switcher at the bottom and the user at the bottom. A slim header sits over the canvas with breadcrumbs or the page title, and the New ticket and notifications actions. Mobile gets a Sheet drawer with the same rail content. The navbar layout option stays (admin setting) and is restyled to the chrome band. |
| **Dashboard** | "Your shift at a glance": a personal KPI row (StatCards), the status distribution bar (status spine colours, links into the board), a "Needs you now" list (SLA risk, mine), unclaimed tickets, and tasks. For users with `report:read` it adds branch trends. No vanity charts. |
| **Tickets** | A Kanban board as the default view, with the table as a secondary "List" view for bulk scanning. Specified in [`tickets-kanban-ux.md`](./tickets-kanban-ux.md). |
| **Ticket detail** | The Phase 3 workspace already built (header, timeline, composer, inspector), restyled to these recipes: status spine on the header, inspector sections as level-1 cards on canvas. |
| **Customers and KB** | Entity headers with avatar or initials and a key-facts row. The KB uses a reading layout (`max-w-prose`, `body-lg`). |
| **Admin and settings** | List plus Sheet editor. Tables are used where data is genuinely tabular (users, audit log, API keys). |
| **Portal** | The same language, with a lighter chrome (white header with a brand stripe), reading-width content and friendlier copy. Customers see their ticket status through the same status spine, so both sides of the product speak the same visual language. |
