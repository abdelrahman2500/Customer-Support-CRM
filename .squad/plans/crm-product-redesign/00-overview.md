# crm-product-redesign — master overview (product redesign roadmap)

Entry point for the **product redesign** track. It **supersedes the remaining, unstarted part** of [`../crm-ui-ux-redesign/00-overview.md`](../crm-ui-ux-redesign/00-overview.md) (RD-3.10 … RD-7.8).

Everything already shipped in that track (Stories 177–209) is kept as the foundation and is not reopened.

Companions:
- [`visual-direction.md`](./visual-direction.md): design principles and visual language.
- [`tickets-kanban-ux.md`](./tickets-kanban-ux.md): the Tickets board specification.
- [`progress.md`](./progress.md): live status.

Status: **active roadmap — approved 2026-10-05** (decisions in §9). This is the roadmap all redesign work now follows. Nothing in this track is implemented yet; Story 210 starts only on instruction. Story IDs here are track IDs (`PR-<phase>.<n>`). The repository Story numbers below continue from the next free number, **210**.

---

## 1. Why re-plan

The previous track was a sequence of small, bounded fixes, 71 Stories against audit findings. It built an excellent foundation: tokens, dark mode, branding tiers, primitives, the shell, and the ticket workspace.

Its remaining 42 Stories, however, would mostly polish screens one finding at a time, on the current visual language and the current table-first Tickets page. The new goal is different: **a demo-worthy, premium product with a distinctive visual identity and a Kanban-first ticket workflow.** That changes the order of work:

1. Set the **visual language v2** first, so no screen is polished twice.
2. Rebuild the **shell and the three hero surfaces** (Tickets board, Ticket detail, Dashboard) next. These are what a demo shows.
3. Bring **supporting screens and the portal** into the same language, in a few larger, coherent Stories rather than many small ones.
4. Do **accessibility, responsive, RTL and dark-mode hardening once**, on the finished UI, as an audit and gap-fix. Each Story already meets the baseline (§6), so hardening is never rework.

## 2. What was inspected (2026-10-05)

- **Plans:**
  - `crm-ui-ux-redesign/00-overview.md` (roadmap, §2 direction, §10 guardrails, §11 DoD, §12 decisions D1–D12);
  - `progress.md` (Stories 177–209, all deferred items);
  - `recon.md`;
  - `00-index.md`.
- **API:**
  - the `Ticket` model and enums;
  - `UpdateTicketDto` and the PATCH flow and its side-effect listeners;
  - the permissive transition map;
  - the `GET /tickets` filters, sort and pagination;
  - the string-permission guard (no CASL) and branch/department scoping;
  - the socket.io rooms (no branch-level ticket events);
  - the `/reports/*` endpoints (`report:read`, which Agents don't have);
  - auth (no forgot-password; portal contacts can't self-register).
- **Web:**
  - the route tree and shell (navbar/sidebar layouts, mobile hamburger dropdown);
  - the ticket list (URL filters, table, 31 specs), dashboard (2 KPIs, 3 panels, no charts) and reports (hand-rolled charts);
  - every remaining screen;
  - no UI permission model (by design);
  - i18n/RTL (`localeDirection`, logical classes, date helpers, no number helper);
  - tests: 96 web specs, 52 ui, 49 portal, 7 Playwright specs, no visual regression.
- **`@crm/ui`:** the full primitive inventory (Combobox, MessageThread, Composer, FileDropzone, Table with mobile cards, Avatar, Tabs, Popover, Dialog, …) and the token layer (colour families, radius, spacing, type scale, shadows, motion, dark, brand tiers).
- **Portal:**
  - its routes (home, tickets with inline create, detail, KB, chat, notifications, account, login);
  - portal copies of the web components;
  - branding fetched client-side only.
- **Libraries:** no drag-and-drop, no virtualization and no chart library is installed anywhere.

## 3. What is kept, and what happens to every remaining RD item

**Kept as-is (complete):** RD-0.1 … RD-3.9, Stories 177–209.
- Tokens v2 (colour, shape, motion, type), the palette guard, dark mode and theme resolution, preference controls, branch branding (model and admin preview).
- Primitives: Button, Badge, Alert, form controls, surfaces and overlays, Table v2, display primitives, Toast v2.
- The ticket status/priority presentation, `SlaIndicator`, i18n leak fixes and the date helper.
- The agent header, nav surfaces, PageHeader v2, ErrorState and boundaries, the portal header.
- The ticket workspace: header and actions, inspector, Combobox and assignee picker, MessageThread, unified timeline, Composer v2, composer tools, AI assist panel.

These are restyled where needed through the v2 tokens and recipes. Their behaviour, specs and APIs stay.

**Disposition of the 42 unstarted items:**

| RD item | Disposition | Where it goes |
|---|---|---|
| RD-3.10 KB references section | **Merged** | PR-3.4 |
| RD-3.11 Customer context section | **Merged** | PR-3.4 |
| RD-3.12 Mobile ticket workspace + skeleton | **Merged** | PR-3.5 |
| RD-3.13 Realtime change cues | **Merged** | PR-3.3 (board cues) + PR-3.4 (ticket header cues), one shared cue vocabulary |
| RD-3.14 Prev/next + shortcuts | **Split** | prev/next → PR-3.5 (follows board/list order); shortcuts → **deferred** (optional, D8) |
| RD-4.1 ListToolbar primitive | **Merged** | primitive → PR-1.2; adoption → PR-3.1 (board/list) and the screens of Phases 4–5 |
| RD-4.2 Queue quick views + SLA sort | **Merged** | PR-3.1 board toolbar (All/Mine/Unassigned/At risk; SLA-urgency sort) |
| RD-4.3 Ticket list visual v2 | **Merged** | PR-3.1 (the list becomes the secondary "List" view) |
| RD-4.4 Customer list v2 / RD-4.5 Customer detail v2 | **Merged** | PR-4.1 |
| RD-4.6 Dashboard v2 | **Expanded** | PR-3.6 (StatCard and chart primitives → PR-1.2) |
| RD-4.7 Agent KB read mode + list | **Kept** | PR-4.2 |
| RD-4.8 Notifications inbox | **Merged** | PR-4.3 (with account/settings) |
| RD-5.1 Portal frame / RD-5.2 Portal home | **Merged** | PR-5.1 |
| RD-5.3 Portal list+create / RD-5.4 Portal ticket detail | **Merged** | PR-5.2 |
| RD-5.5 Portal KB / RD-5.6 Portal assistant / RD-5.7 Portal account | **Merged** | PR-5.3 (`Switch` primitive → PR-1.2) |
| RD-6.1 Sheet + Users admin | **Split** | Sheet primitive → PR-1.2; Users → PR-4.5 |
| RD-6.3 Roles | **Merged** | PR-4.5 |
| RD-6.2 SLA / RD-6.4 Branches & categories / RD-6.6 System screens | **Merged** | PR-4.6 |
| RD-6.5 Settings deep links | **Merged** | PR-4.3 |
| RD-6.7 Audit log / RD-6.8 Reports v2 | **Merged** | PR-4.7 |
| RD-6.9 Create-form pages | **Merged** | PR-4.4 |
| RD-7.1 FormField sweep / RD-7.2 State sweep / RD-7.3 Error announcements / RD-7.7 A11y audit | **Merged** | PR-6.1 |
| RD-7.4 Responsive / RD-7.5 RTL / RD-7.6 Dark & branding | **Merged** | PR-6.2 |
| RD-7.8 Docs closeout | **Kept** | PR-7.2 |

None of the remaining RD items is dropped outright. They are merged into larger, coherent Stories. Each recon finding they cite (A11Y-02/03/04/06/07, TW-13/15/16, RS-02…08, KB-01, PT-01/02/06, AD-01, RP-01, VL-07/08/11, RTL-04) is carried into the new Story's acceptance criteria and must be closed or explicitly deferred with a reason.

**Already-deferred items, re-homed:**
- Arabic login fallback font and the bright dark login panel → PR-2.2.
- `query-state-card` `opacity-80` → PR-6.1.
- Latin units in Reports average resolution → PR-4.7.
- Audit-log labels → PR-4.7.
- Claim-button wrap and the duplicate New ticket button → PR-3.6 / PR-3.1.
- Near-invisible dark Tier 1 brand → PR-2.1 (the chrome stripe uses a contrast-guarded variant).
- Portal "Live Chat" heading and portal composer → PR-5.2.
- Unused heading keys → PR-7.2.
- Channel field (no schema) and Insert KB link (no portal origin) → stay deferred (§8).

## 4. Phases and Stories

26 Stories (210–235). They are larger than before but still one intake, one plan and one commit each, per `CLAUDE.md` §6. Each Story ends demoable.

### Phase 1 — Visual language v2 and primitive kit

*Goal: the look is decided and the building blocks exist before any screen is redesigned.*

| ID | NN | Story | Scope (summary) |
|---|---|---|---|
| PR-1.1 | 210 | **Visual language v2: tokens and recipes** | **Tokens:** the `chrome` family; warm canvas (light); status `spine` usage; `viz-1…6` palette; contrast specs for all new pairs in both themes. **Recipes:** card, column and inner-block recipes, and the 4-level elevation rule. **Docs:** `13-design-language.md` updated to `visual-direction.md`. **Accent:** indigo is kept (PD-1). No screen changes beyond what the tokens re-skin. |
| PR-1.2 | 211 | **Primitive kit v2** | New `@crm/ui` primitives: `Sheet` (inline-end, RTL, focus trap, sizes), `Switch`, `SegmentedControl` (radio-group semantics; used by Board/List, quick views and the mobile column switcher), `ListToolbar` (search with Enter/blur commit, filter slot, result count `role=status`, clear-all, mobile "Filters (n)" Sheet), `StatCard` (display number, label, delta, link), chart primitives (`BarChart`, `DistributionBar`, `DonutGauge`, moved from web `report-charts.tsx` and tokenised; labels always visible), and `Board`/`BoardColumn` layout primitives (no DnD logic). Each has specs, RTL and dark checks. |
| PR-1.3 | 212 | **Primitive restyle to v2** | The existing primitives adopt the v2 recipes: Card/SectionCard, Badge (status dot variant), Button (hover/pressed on chrome), inputs, Tabs (underline on canvas), Table (row hover, urgency edge cell), EmptyState (icon medallion + action), Skeleton (card-shaped presets), Toast, Avatar (dashed "unassigned" variant). Behaviour unchanged; every existing primitive spec green. |

### Phase 2 — Core shell

| ID | NN | Story | Scope (summary) |
|---|---|---|---|
| PR-2.1 | 213 | **Agent shell v2** | The ink chrome rail: grouped nav with a clearer IA (PD-10; *Work*: Dashboard, Tickets, Customers, Knowledge base; *Insights*: Reports, Audit log; *Configure*: …; *Admin*: …), collapsed 64px rail with tooltips, branch switcher and user at the rail foot, slim header (page context, New ticket, notifications), mobile nav as a `Sheet` drawer (replacing the hamburger dropdown), and the navbar layout restyled to the chrome band. Same routes, same nav items, admin layout setting kept, so `admin-navigation-layout` stays green. Global loading, not-found and error pages restyled. |
| PR-2.2 | 214 | **Authentication v2 (web + portal)** | One shared visual layout for both logins: form card, ink brand panel with the single sanctioned brand wash, and the locale/theme controls. Fixes the Arabic font fallback and the bright dark panel. Session-expired state. Password visibility toggle (client-only). "Forgot password?" becomes a hint ("Ask your administrator to reset it" / portal: "Contact support"), because no backend flow exists (PD-7). Same requests and redirects. |

### Phase 3 — Core product (the demo centrepiece)

| ID | NN | Story | Scope (summary) |
|---|---|---|---|
| PR-3.0 | 215 | **Demo dataset** (PD-6) | Idempotent dev-only seed, `pnpm prisma:seed:demo`: about 120 realistic en/ar tickets across statuses, priorities, categories, agents and customers; SLA targets producing on-track, at-risk, breached and on-hold; messages, notes, KB articles and a few CSAT responses. Never in CI or production. |
| PR-3.1 | 216 | **Tickets board: views, columns, cards, toolbar** | `?view=board\|list` (board default, PD-3); status columns with spine, count and per-column infinite pages; the card anatomy; shared ListToolbar with quick views, filters and sort; the Closed column collapsible; loading/empty/error/filtered states; the < 768 column switcher; the List view as the restyled existing table (all 31 list specs kept). Read-only: no moving yet. |
| PR-3.2 | 217 | **Tickets board: moving cards** | The "Move to" menu, pointer drag, keyboard drag (`@dnd-kit/core`, PD-2), optimistic update with rollback by error code, the Resolved/Closed confirm (PD-5), localized live announcements, focus restoration, reduced motion, RTL arrow mapping, touch press-and-hold. |
| PR-3.3 | 218 | **Tickets board: freshness and verification** | **No backend change** (PD-4 deferred). Board freshness through the existing queries: refetch every 30s while the tab is visible and on window focus; when a refetch shows another actor's change (status, assignee, priority) or a new ticket, the card settles into place with the change cue (shared vocabulary with RD-3.13); conflict toast when a move collides with a change; Playwright `agent-moves-ticket-on-board.spec.ts`; the board harness matrix. |
| PR-3.4 | 219 | **Ticket detail v2: inspector completion and polish** | Restyle to the v2 recipes (status spine in the header, inspector cards on canvas); KB references section (RD-3.10: links, unique names, debounce, per-row pending); customer context section (RD-3.11: identity, raising contact, open tickets); header realtime change cues (RD-3.13). |
| PR-3.5 | 220 | **Ticket detail: mobile/tablet, skeleton, prev/next** | RD-3.12: compact sticky header, Conversation \| Details tabs, composer pinned, layout-true skeleton; prev/next following the board/list order and filters from the URL (RD-3.14, minus shortcuts). |
| PR-3.6 | 221 | **Dashboard v2** | "Your shift at a glance": StatCards (mine open, unclaimed, at risk, breached, from list totals); the status distribution bar linking into board columns; "Needs you now" (my tickets by SLA urgency, as mini cards); Unclaimed with Claim (wrap fix); Tasks; for `report:read` users, branch volume and SLA compliance trends (hidden gracefully on 403). |

### Phase 4 — Supporting experiences

| ID | NN | Story | Scope (summary) |
|---|---|---|---|
| PR-4.1 | 222 | **Customers v2** | List (toolbar, avatar rows, mobile cards); detail entity header, contacts, Sheet/Dialog editors (add contact, portal password), status-change confirm, ticket mini-cards linking to the board filtered by customer. Same payloads. |
| PR-4.2 | 223 | **Knowledge base (agent) v2** | Read mode by default (reading layout), Edit switch, editor tabs default to the UI locale, list with toolbar and row menu (RD-4.7). `kb-publish-portal-visibility` stays green. |
| PR-4.3 | 224 | **Notifications, account and settings** | Notifications inbox (history first, link to the ticket), one "Account" area (profile facts, sessions, change password), Settings tabs with `?tab=` deep links, business hours and AI settings restyled. |
| PR-4.4 | 225 | **Forms and create flows** | The form-section recipe; the five create pages (ticket, customer, user, SLA policy, article) on Card + FormField with required markers; the customer Combobox on create-ticket; inline errors near submit; disabled-submit reasons. |
| PR-4.5 | 226 | **Admin I: people and access** | Users list with Sheet editor (roles, assignment, reset password, unlock); roles with a grouped permission grid in a Sheet. Same payloads. |
| PR-4.6 | 227 | **Admin II: configuration** | SLA policies, branches/departments, ticket and KB categories, automation rules, quick replies, notification templates, webhooks, API keys: list + Sheet/Dialog editors, `ActiveBadge`, QueryStateCard, one `h1` per state. |
| PR-4.7 | 228 | **Insights: Reports and Audit log** | Reports: one toolbar, URL filters, StatCards, chart primitives, one page-level error, localized units. Audit log: toolbar, localized action labels, diff in a Sheet. |

### Phase 5 — Portal

| ID | NN | Story | Scope (summary) |
|---|---|---|---|
| PR-5.1 | 229 | **Portal frame and home** | Light chrome with brand stripe, server-side branding (`initialBranding`, as web already does) or a reserved logo box; reading widths; home with the three CTAs, recent tickets shown with the status spine, and help highlights. |
| PR-5.2 | 230 | **Portal tickets** | List (cards with status spine) and create (FormField, required markers, navigate to the new ticket if the response has the id); detail on the shared `MessageThread` + `Composer`, attachments on `FileDropzone`, CSAT prominent when resolved, closed-ticket hint. Portal chat heading renamed. `customer-submits-ticket` and live-chat green. |
| PR-5.3 | 231 | **Portal help and account** | KB search and reading layout with "Still need help?"; assistant chat full-height on `MessageThread`/`Composer` with `role=status` thinking and escalation confirm; notifications and account with `Switch` preferences. |

### Phase 6 — Accessibility, responsive and RTL hardening (audit + gap-fix only)

| ID | NN | Story | Scope (summary) |
|---|---|---|---|
| PR-6.1 | 232 | **Accessibility hardening** | A keyboard walk and screen-reader smoke test of every route; the manual axe/Lighthouse scan (0 critical/serious); FormField and state-pattern guards (RD-7.1/7.2) and inline-error announcements (RD-7.3) for anything left; closes or defers every A11Y-* finding with a reason. |
| PR-6.2 | 233 | **Responsive, RTL and theme parity** | Every route × 390/768/1280/1440 × en/ar × light/dark × 4 reference brands; fixes gaps only; mixed-direction strings (`<bdi>`); Latin digits kept in Arabic (PD-8), verified consistent across numbers, dates and charts; chart and logo checks in dark mode. |

### Phase 7 — QA and closeout

| ID | NN | Story | Scope (summary) |
|---|---|---|---|
| PR-7.1 | 234 | **Visual regression baseline** (PD-9) | Playwright `toHaveScreenshot` suite for the hero screens (board, ticket, dashboard, login, portal home/ticket) × en/ar × light/dark at 1280 and 390, run locally with committed baselines. Local only, not CI-gated (PD-9). |
| PR-7.2 | 235 | **Closeout** | Design-language docs to match what shipped, primitives/patterns index, stale doc comments, unused message keys, a demo walkthrough script (`docs/demo-script.md`), `00-index.md` rows. |

Numbers are provisional: they are assigned in order as Stories are picked up, so an inserted or split Story shifts the ones after it.

**Dependency order:** PR-1.1 → PR-1.2 → PR-1.3 → PR-2.x → PR-3.0 → PR-3.1 → PR-3.2 → PR-3.3. PR-3.4–3.6 can follow PR-3.1 in any order. Phases 4 and 5 need Phase 1 plus PR-2.1. Phase 6 needs Phases 3–5. Phase 7 is last.

**Demo-ready milestone:** the end of Phase 3 (Stories 210–221). The login, shell, board, ticket and dashboard then form a complete, polished demo path, even if Phases 4–7 are not finished.

## 5. Incremental vs. now-obsolete work

Nothing completed becomes obsolete. Two completed pieces change role:
- The **ticket list table** (Story 188, plus list behaviour) becomes the secondary "List" view rather than the landing experience. It is kept, because some tasks are table-shaped.
- The **dashboard StatTile** is replaced by the `@crm/ui` `StatCard`.

## 6. How accessibility, responsive, RTL, dark mode and testing are built in (not bolted on)

**Every Story's definition of done** (checked before commit; recorded in `progress.md`):
1. **Keyboard:** every pointer interaction has a keyboard path. Focus is visible in both themes and restored after overlays and moves.
2. **Names and roles:** every control is named, and repeated row actions have unique names. Live regions are used for async results.
3. **Contrast:** token pairs only, with contrast specs for new pairs.
4. **RTL:** logical utilities only (the existing guard). Arrow-key semantics follow `dir`. The Story is checked in `/ar` at the same time as `/en`.
5. **Responsive:** no page-level horizontal scroll at 390, 768, 1280 or 1440, with a mobile strategy stated in the plan.
6. **Dark mode and branding:** checked in dark mode and with one Tier 2 brand.
7. **Tests:**
   - unit specs for new behaviour;
   - existing specs never weakened (a selector change is recorded with its reason);
   - the relevant Playwright specs green;
   - a harness matrix over the screens it changes;
   - typecheck, lint and build.

Phase 6 is therefore an **audit of the finished product plus targeted fixes**, not a sweep that redoes screens. Phase 7 adds regression protection once the UI stops moving.

## 7. Guardrails (changes from the previous track's §10)

These still hold:
- no auth-architecture changes;
- no business-rule changes (transitions, SLA computation, CSAT);
- no permission-model changes or permission-gated UI (D6);
- no routing changes except additive query params (`?view=`, `?tab=`, report filters, board filters);
- no rich text, no new channels, no global search or command palette;
- the `identity.e2e-spec.ts` isolation defects stay out of scope.

**Approved changes (2026-10-05):**

| Guardrail | Change | Decision |
|---|---|---|
| "No framework or library changes" | **One** drag-and-drop library: `@dnd-kit/core` (+ `@dnd-kit/utilities`) | PD-2 |
| "No backend/API/DB changes" | A **dev-only demo seed** (`apps/api`, never run in CI or production) — the only backend-side addition | PD-6 |
| "No visual-regression" | A **local** Playwright screenshot suite, not CI-gated | PD-9 |

The "no backend/API changes" guardrail otherwise **still holds**: the realtime broadcast (PD-4) is deferred, so the board uses the existing endpoints only.

## 8. Out of scope (explicitly)

- Manual card ordering (needs a rank field).
- Bulk actions on the board.
- Swimlanes.
- WIP limits.
- Saved custom views (could follow later on the existing dashboards API).
- Forgot/reset password and portal self-registration (no backend).
- The ticket channel field (no schema).
- Insert KB link (no portal origin config).
- Keyboard shortcuts (D8, optional; revisit after Phase 3).
- AI result persistence.
- Read/unread notifications.
- Collision and typing indicators.
- A branch-level realtime broadcast for the board (PD-4, deferred): the board refreshes every 30s and on focus instead.

## 9. Decisions (approved 2026-10-05)

| ID | Decision | Outcome |
|---|---|---|
| **PD-1** | Accent hue | **Approved: indigo** (D1). The ink chrome and status spine carry the identity; Tier 2 branding stays tuned to indigo. |
| **PD-2** | Drag-and-drop implementation | **Approved: `@dnd-kit/core`** (+ `@dnd-kit/utilities`): keyboard, pointer and touch sensors, screen-reader announcements, React 18 compatible. Added in PR-3.2. |
| **PD-3** | `/tickets` default view | **Approved: Board by default**, List via the toggle (`?view=list`), with the last choice remembered per browser. |
| **PD-4** | Live board across screens | **Deferred.** No realtime backend change in this track. The board refetches every 30s while visible and on window focus; the agent's own moves are instant (optimistic). The relay design stays documented in `tickets-kanban-ux.md` §6 for a later track. |
| **PD-5** | Moving into Resolved/Closed | **Approved: inline confirm popover**, because the customer is notified. No undo toast. |
| **PD-6** | Demo dataset seed | **Approved**: dev-only and idempotent (PR-3.0, Story 215). |
| **PD-7** | "Forgot password?" on login | **Approved: a help hint** (agents: ask an administrator to reset it; portal: contact support), never a link to a non-existent flow (PR-2.2). |
| **PD-8** | Arabic digits | **Approved: keep Latin digits** in the Arabic UI, consistent with today's product. This supersedes the intent of D4 in the foundation track; no `numberingSystem` override is added. |
| **PD-9** | Visual regression | **Approved: local-only** Playwright screenshot baselines for the hero screens, not CI-gated (PR-7.1). |
| **PD-10** | Navigation IA regrouping | **Approved**: Work / Insights / Configure / Admin / Account grouping; same items, pages and URLs (PR-2.1). |
| **PD-11** | Previous-track workflow | **Approved**: one intake, one plan and one commit per Story continue. The umbrella `crm-product-redesign` is never used as a squad slug. |

## 10. Risks

| Risk | Mitigation |
|---|---|
| **Drag and drop is the hardest new interaction** (a11y, touch, RTL, scroll containers). | dnd-kit keyboard sensor plus a Move-to menu fallback on every breakpoint; a dedicated Story (PR-3.2) and a Playwright spec. |
| **Board load**: 4 list requests per filter change; large columns. | 25 cards per column and "Show more"; virtualization revisited only above about 300 loaded cards. |
| **Concurrent edits** (last write wins); another agent's changes appear up to 30s late (PD-4 deferred). | Refetch every 30s and on focus, the change cue when a refetch shows another actor's change, and a conflict toast. Versioning and the realtime broadcast are deferred. |
| **Visual v2 token changes ripple everywhere** (warm canvas, chrome). | Introduced in PR-1.1 behind the existing token layer, with contrast specs and the full harness before any screen work. |
| **Existing Playwright specs depend on list markup.** | The List view and the search field behaviour are preserved; the board keeps the same search placeholder and commit behaviour. |
| **Customer notification side effects of status moves.** | PD-5 confirm; copy states that the customer is notified. |
| **Larger Stories make commits bigger to review.** | Each plan lists acceptance criteria per sub-area; evidence (harness matrix) per Story. |
| **Concurrent sessions share the worktree.** | Path-scoped commits (existing practice). |
