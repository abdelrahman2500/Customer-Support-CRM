# core-completion-roadmap — plan overview

**Type:** cross-cutting roadmap (planning only — no code, tests, schema, or
config changed to produce this or any file in this folder). Not a single
Story; an index over many proposed future Stories, none yet assigned a real
global `NN` (see "Numbering" below).

## Purpose

Re-verify the repository against the most recent Core Features Recon, then
build a dependency-aware, zero-cost-constrained roadmap from the current
product to a genuinely complete CRM against the 12 Core Features named in
`docs/architecture/03-domain-boundaries.md` and this repo's own product
definition. Companion documents:

| File | Contents |
| --- | --- |
| [01-core-gap-matrix.md](./01-core-gap-matrix.md) | Every requirement across all 12 Core Features: current state, existing implementation, remaining gap, priority, dependency, proposed story, complexity, blocking decision. |
| [02-product-decisions.md](./02-product-decisions.md) | Decision records for Email/WhatsApp/SMS providers, ERP/Integrations, and the AI Suggested Solutions feasibility check — under the hard zero-cost/no-paid-service constraint. Ends with the Zero-Cost Feasibility Matrix. |
| [03-dependency-graph.md](./03-dependency-graph.md) | The proposed-story dependency graph, the 7-phase roadmap (Phase 0–6), and the single recommended next story. |
| `RM-00` … `RM-25` story files (this folder) | One file per proposed story — goal, why, dependencies, backend/frontend/worker/schema work, tests, acceptance criteria, DoD, priority, blocked status. |

## Numbering

Every folder under `.squad/plans/` other than this one documents Stories
**already implemented** and indexed in `.squad/plans/00-index.md` with a real
global `NN` from git history. Nothing in this roadmap has been implemented —
assigning speculative `NN` values now would collide with or misrepresent that
sequence. Proposed stories here are instead numbered `RM-00`…`RM-25`
("**R**oadmap"), a namespace that is never mixed into the real `NN` sequence.
When a story from this roadmap is actually selected and implemented, it earns
its real, next-available `NN` at that time, and its own dedicated
`.squad/plans/<slug>/` + `.squad/stories/<slug>/<slug>/intake.md` are created
then, following this repository's normal convention — this roadmap's `RM-xx`
files are the source material for that, not a substitute for it.

`.squad/plans/00-index.md` is **not modified** by this roadmap: its own header
describes it as a record of implemented Stories with real `NN` values, and
every existing row already follows that convention (including its own
"`(unplanned)`" backfill rows, which document Stories that *did* land in git
history without a formal plan artifact — never a Story that hasn't happened
yet). Adding prospective rows for `RM-00`…`RM-25` now would be the one
inconsistency with that established convention the task explicitly asked to
avoid.

## Repository checkpoint at time of writing

- Branch: `main`. HEAD: `b0eac6e` — "feat(a11y-3): add a skip-to-main-content
  link to both apps' shells". Working tree clean. `git rev-list --left-right
  --count HEAD...origin/main` → `0 0` (fully synced with `origin`).
- **The repository moved since the Core Features Recon that seeded this
  task.** The Recon's own checkpoint was HEAD `7220419`
  ("feat(nav-2b): cap the agent workspace shell's content width"). One
  further commit landed since: `b0eac6e` (a11y skip-link, both apps' shells)
  — accessibility polish, orthogonal to every gap the Recon found. It does
  not change any Core Gap Matrix entry below. This is exactly the kind of
  drift `CLAUDE.md`'s "concurrent sessions share one worktree" note warns
  about; re-verifying before planning (rather than trusting the Recon
  verbatim) is why this was caught.
- **Cross-checked every gap in the Recon's P0–P2 list against
  `.squad/plans/**` before proposing a story for it** (§"Re-verification"
  below) — nothing proposed here duplicates an already-implemented Story.
  Two gaps turned out to be *narrower* than the Recon's phrasing suggested
  once checked against the actual prior plan's own scope decisions (workspace
  presence, and the unbounded-list tech debt); both are reflected accurately
  in the Core Gap Matrix and the affected story files.

## Re-verification against `.squad/plans/**` (avoiding duplicate stories)

Read in full before proposing anything: `agent-presence-ui` (108),
`bounded-list-caps` (106), `customer-portal-notification-delivery` (86),
`ticket-list-cap` (105), `reporting-saved-dashboards` (110),
`sla-automation-rules` (57), `identity-security-hardening` (100), plus a
directory listing of all ~100 other plan folders and `docs/architecture/09-
integrations.md` in full.

Findings that changed this roadmap's shape:

1. **Presence is not simply "missing from the workspace."** Story 108
   deliberately scoped the presence indicator to the Users admin list, not a
   ticket-assignment picker, as an explicit, reasoned scope decision (its own
   plan: *"the natural, minimal integration point, adding one column to an
   existing table rather than a new UI surface"*). `RM-06` below is
   correctly framed as **extending** Story 108's foundation into the ticket
   workspace, not redoing it.
2. **The unbounded-list tech debt is not one thing.** Story 106 already
   capped the three branch-wide unbounded lists it found highest-risk
   (`CustomersService.listCustomers`, three `KnowledgeBaseService` list
   methods, `NotificationsService.listNotifications`). It explicitly did
   **not** touch Users, Roles, Automation Rules, Quick Replies, or SLA
   Policies list endpoints — those remain genuinely uncapped today. Folded
   into `RM-23` (System Settings) as a minor, explicitly-scoped addendum
   rather than invented as its own Story, per the "don't turn every debt item
   into a feature story" instruction.
3. **Portal notification delivery's own plan (Story 86) already discloses**
   "no email/SMS/WhatsApp delivery" as a first-iteration non-goal, deferred
   to a later Story — confirming (not merely repeating the Recon's claim)
   that portal email delivery is a genuine, still-open gap, not an oversight
   this roadmap would be duplicating.
4. **Reporting Saved Dashboards' own plan (Story 110) states outright**:
   *"this codebase has no charting library anywhere... inventing one is out
   of scope for what closes this gap."* This directly satisfies this task's
   instruction to "verify whether one already exists" before proposing
   `RM-08` — confirmed, by the prior Story's own author, that it does not.
5. **SLA Automation Rules' own plan (Story 57) explicitly defers** "a wider
   action set (auto-set category/priority/department)" to a future Story
   "that also addresses [the SLA-policy-match] reconciliation" — and notes
   `assignedToUserId` participates in no SLA-policy-matching dimension. This
   directly informs `RM-24` (round-robin/load-based assignment, an
   unphased/parallel-track item): it is safe to build without the
   reconciliation risk Story 57 flagged, because it only ever changes
   `assignedToUserId`, never category/priority/department.
6. **`docs/architecture/09-integrations.md` was re-read in full.** It
   describes an `IntegrationsModule`/`integrations` schema, an `ErpAdapter`/
   `EmailAdapter` interface pattern, API keys for machine-to-machine
   consumers, and provider-specific webhook signature schemes (Twilio, Meta)
   in complete architectural detail — none of it exists in code. This is not
   a new finding (the Recon already found it) but it is the source this
   roadmap's Phase 4/6 stories draw their provider-neutral shape from, since
   the docs already did the interface-design thinking; nothing here reinvents
   that shape, it implements it.

## What this roadmap explicitly does NOT propose

Per the task's own "avoid scope inflation" instruction, cross-checked against
current code and existing plans — none of the following get a story, because
each is already complete:

- Ticket Management's core lifecycle, RBAC/permissions, the Customer Portal's
  auth/isolation, i18n (Arabic/English/RTL), the existing `@crm/ui` component
  library, the existing Anthropic AI provider abstraction, and the existing
  Socket.IO realtime architecture. Each is COMPLETE per the Core Gap Matrix
  and gets extended, never rebuilt, by any story below.
