# Core Gap Matrix

Re-verified against current HEAD (`b0eac6e`) and every existing `.squad/plans/**`
folder (see `00-overview.md`'s Re-verification section) — not copied verbatim
from the Recon. States are exactly `COMPLETE` / `PARTIAL` / `MISSING` /
`BLOCKED` / `N/A`, per the task's instruction not to mark something COMPLETE
merely because infrastructure exists.

## 1. Customer Management

| Requirement | State | Existing implementation | Remaining gap | Priority | Dependency | Proposed story | Complexity | Blocking decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Customer profiles | COMPLETE | `Customer` model, `customers.controller.ts`/`.service.ts`, `customer-detail-view.tsx` | — | — | — | — | — | none |
| Contact details | COMPLETE | `Contact` model, create/list/update (no delete, by design — contacts have no independent lifecycle) | — | — | — | — | — | none |
| Interaction history | COMPLETE | `customer-detail-view.tsx` — real, paginated `useTicketsQuery({customerId})` | — | — | — | — | — | none |
| Notes | MISSING | No `CustomerNote` model anywhere in `schema.prisma`; `TicketNote` exists but is ticket-scoped only | Customer-level internal notes | P2 | none | RM-02 | Small | none |
| Attachments | COMPLETE | `CustomerAttachment` model, S3-backed, `AttachmentsCard` UI | — | — | — | — | — | none |

## 2. Ticket Management

| Requirement | State | Existing implementation | Remaining gap | Priority | Dependency | Proposed story | Complexity | Blocking decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Create and track tickets | COMPLETE | `tickets.controller.ts`/`.service.ts`, full CRUD, in-scope validation at creation | — | — | — | — | — | none |
| Categories and priorities | COMPLETE | `TicketCategory` FK (Story 120), `TicketPriority` enum | — | — | — | — | — | none |
| Assign tickets to agents | COMPLETE | `Ticket.assignedToUserId`, `PATCH /tickets/:id` | — | — | — | — | — | none |
| Status | PARTIAL | `TicketStatus` enum + `resolvedAt` tier logic | No transition-graph validation — any status accepted from any status | P2 | none | RM-01 | Small | none |
| Escalation | COMPLETE | SLA breach → `SlaEscalation` → `TICKET_ESCALATED_EVENT`, realtime + UI card | — | — | — | — | — | none |
| Ticket history | COMPLETE | `TicketHistoryEntry` — genuine append-only event log, not current-values-only | — | — | — | — | — | none |

## 3. Communication Channels

| Requirement | State | Existing implementation | Remaining gap | Priority | Dependency | Proposed story | Complexity | Blocking decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Email | MISSING | `ChannelType.EMAIL` reserved enum value only, never written | Real send/receive path | P0 (desired) | Phase 4 foundation (RM-13/14) | RM-15 (outbound), RM-16 (inbound) | Medium / Medium | **PRODUCT DECISION REQUIRED** — see `02-product-decisions.md`. Outbound is buildable now against Mailhog (dev); production relay choice is the actual open decision. |
| WhatsApp | MISSING | `ChannelType.WHATSAPP` reserved enum value only | Real send/receive path | P0 (desired) | Phase 4 foundation | RM-17 | Medium-Large | **PRODUCT-DECISION-BLOCKED — NO ZERO-COST PROVIDER CONFIRMED** |
| Live chat | COMPLETE | `TicketChannelService`/`ChannelMessagesService`, realtime via Socket.IO, tested | — | — | — | — | — | none |
| SMS | MISSING | `ChannelType.SMS` reserved enum value only | Real send/receive path | P0 (desired) | Phase 4 foundation | RM-18 | Medium | **PRODUCT-DECISION-BLOCKED — NO ZERO-COST PROVIDER CONFIRMED** |
| Web forms | COMPLETE | Public rate-limited intake, tested | — | — | — | — | — | none |

## 4. Agent Dashboard

| Requirement | State | Existing implementation | Remaining gap | Priority | Dependency | Proposed story | Complexity | Blocking decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Assigned tickets | COMPLETE | `dashboard-view.tsx`, server-computed queue | — | — | — | — | — | none |
| Customer information | PARTIAL | `ticket-detail-view.tsx` links out to `/customers/[id]` only | No embedded context panel in the ticket workspace | P1 | none | RM-04 | Small-Medium | none |
| Tasks and reminders | MISSING | No model, API, or UI anywhere | Full capability | P0 | none | RM-03 | Medium | none |
| Quick replies | COMPLETE | `QuickReply` model, composer picker | — | — | — | — | — | none |
| Team collaboration | PARTIAL | `TicketNote` real + realtime; presence infra (Story 108) real but scoped to the Users admin list only; @mentions absent | Presence + mentions inside the ticket workspace itself | P1 | Story 108 (`PresenceService`/`useAgentPresence`) | RM-06 | Medium-Large | none |

## 5. SLA & Automation

| Requirement | State | Existing implementation | Remaining gap | Priority | Dependency | Proposed story | Complexity | Blocking decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Response and resolution targets | COMPLETE | `SlaTargetListener`, business-hours-aware, recurring worker enforcement | — | — | — | — | — | none |
| Automatic assignment | PARTIAL | `AutomationRule` always assigns to one fixed agent (Story 57, deliberately v1-scoped) | No round-robin/load-based mode | P3 | Story 57 (`AutomationRule`/`AutomationEvaluationListener`) | RM-24 (parallel track) | Small-Medium | none |
| Escalation rules | COMPLETE | `SlaEscalationListener`, idempotent | — | — | — | — | — | none |
| Alerts and notifications | COMPLETE | `BranchNotificationRealtimeListener`, `NotificationLog` writes | — | — | — | — | — | none |
| *(additional finding, not in the 12-core bullet list)* SLA on-hold/pause | MISSING | Targets are fixed absolute timestamps; no on-hold mechanism | SLA pause/resume | P3 | none | RM-25 (parallel track) | Small | none |

## 6. Knowledge Base

| Requirement | State | Existing implementation | Remaining gap | Priority | Dependency | Proposed story | Complexity | Blocking decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FAQs | COMPLETE | `KnowledgeBaseArticle` (single model covers all content types) | — | — | — | — | — | none |
| Help articles | COMPLETE | same model | — | — | — | — | — | none |
| Solutions and guides | COMPLETE | same model | — | — | — | — | — | none |
| Search | COMPLETE | Real Postgres `tsvector`/`websearch_to_tsquery`/`ts_rank`, GIN-indexed | — | — | — | — | — | none |
| *(additional finding)* Category/tag taxonomy | MISSING | `category` is a free-text nullable string, no dedicated model | Dedicated category/tag entity | P3 | none | **not proposed this roadmap** — minor, deliberately deferred to avoid scope inflation (not in the P0–P2 list this roadmap was scoped against) | — | none |
| *(additional finding)* Article attachments/media | MISSING | Articles are text/markdown `body` only | Media attachments | P3 | none | **not proposed this roadmap** — same reason | — | none |
| *(additional finding)* Ticket ↔ KB linkage | MISSING | No cross-link anywhere between `tickets` and `knowledge-base` modules | Search/attach a KB article from an open ticket | P1 | none | RM-05 | Medium | none |

## 7. AI Features

| Requirement | State | Existing implementation | Remaining gap | Priority | Dependency | Proposed story | Complexity | Blocking decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ticket summaries | BLOCKED | Fully implemented (async job, `AiPromptLog`, realtime hand-back, graceful DISABLED state) | none in code | — | — | — | — | Operational only — `ANTHROPIC_API_KEY` not set by default (env var, not a story) |
| Suggested replies | BLOCKED | Same pipeline | none in code | — | — | — | — | Same operational blocker |
| Automatic categorization | BLOCKED | Same pipeline, advisory-only by design | none in code | — | — | — | — | Same operational blocker |
| Suggested solutions | MISSING | No `AiFeature` value, route, model, or UI at any layer | Full capability | P0 | none — reuses existing `AiProcessingProcessor`/`AiPromptLog`/realtime pattern | RM-00 | Medium | none — see `02-product-decisions.md`'s feasibility check; does **not** need a new provider |
| AI chatbot | BLOCKED | Fully implemented (portal `ChatSession`/`ChatMessage`, KB-grounded) | none in code | — | — | — | — | Same operational blocker |

## 8. Customer Portal

| Requirement | State | Existing implementation | Remaining gap | Priority | Dependency | Proposed story | Complexity | Blocking decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Submit tickets | COMPLETE | `createTicketForContact`, server-resolved identity | — | — | — | — | — | none |
| Track requests | COMPLETE | `findTicketInCustomerScope` | — | — | — | — | — | none |
| View history | COMPLETE | paginated list + history endpoint | — | — | — | — | — | none |
| Access FAQs | COMPLETE | `portal-knowledge-base.controller.ts`, published-only | — | — | — | — | — | none |
| Submit feedback | COMPLETE | `TicketCsatResponse`, one-time, gated to resolved/closed | — | — | — | — | — | none |
| *(additional finding)* Notification delivery channel | PARTIAL | In-app + realtime only (Story 86/88/90); Story 86's own plan discloses email/SMS/WhatsApp delivery as an explicit deferred non-goal | Email delivery of existing notification events | P2 | RM-15 (Email outbound adapter) | RM-19 | Small-Medium | Same as Email channel — see `02-product-decisions.md` |

## 9. Reports & Management

| Requirement | State | Existing implementation | Remaining gap | Priority | Dependency | Proposed story | Complexity | Blocking decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ticket reports | COMPLETE | Real `groupBy` aggregation, CSV export | — | — | — | — | — | none |
| SLA performance | COMPLETE | Null-safe compliance-rate calculation | — | — | — | — | — | none |
| Agent performance | COMPLETE (semantics caveat) | Per-agent open/resolved counts; meaning silently shifts under a date filter (disclosed in the widget's own doc comment) | UI cue distinguishing the two modes | P2 | none | folded into RM-09 | Small | none |
| Customer satisfaction | COMPLETE | `TicketCsatResponse` aggregate | — | — | — | — | — | none |
| Management dashboards | PARTIAL | 6 real metrics + Saved Dashboards (Story 110) rendered as plain stat tiles; no charting library exists (confirmed by Story 110's own doc comment); no branch/department/agent/category filter beyond the caller's single active branch; no cross-branch manager rollup | Charts; cross-dimension filters; manager rollup | P1 | none | RM-07 (filters/rollup), RM-08 (charts) | Large / Medium | none |

## 10. Security & Administration

| Requirement | State | Existing implementation | Remaining gap | Priority | Dependency | Proposed story | Complexity | Blocking decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Users and roles | COMPLETE | Full CRUD beyond seed, verified guardrails on seeded roles | — | — | — | — | — | none |
| Permissions | COMPLETE | Globally-enforced `PermissionsGuard`, fresh per-request DB check | — | — | — | — | — | none |
| Audit logs | COMPLETE | Append-only at the DB-grant level, generic + 10+ semantic writes | — | — | — | — | — | none |
| System configuration | PARTIAL | `BrandingConfig`/`AiSettings`/`BusinessHoursCalendar` each exist independently; no consolidated screen | Single admin surface composing existing config screens | P2 | Existing branding/AI-settings/business-hours endpoints | RM-23 (parallel track) | Small-Medium | none |

## 11. Integrations

| Requirement | State | Existing implementation | Remaining gap | Priority | Dependency | Proposed story | Complexity | Blocking decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| APIs | COMPLETE | 29 controllers under `/api/v1`, OpenAPI/Swagger (non-production) | — | — | — | — | — | none |
| ERP | MISSING | Zero real code; `docs/architecture/09-integrations.md` itself: protocol "remain[s] open until a future story names them" | Adapter once ERP/protocol chosen | P0 (desired), **BLOCKED** | Integration Hub foundation (RM-20/21/22) | **not proposed this roadmap** — do not invent an ERP | — | **BLOCKED — external ERP/protocol selection required** (unrelated to zero-cost; a specific target system, not a fee, is what's missing) |
| Email, SMS & WhatsApp | MISSING | See Core 3 | Same as Core 3 | P0 (desired) | Phase 4 foundation | RM-15/16/17/18 | — | See `02-product-decisions.md` |
| External systems (webhooks, API keys/M2M, Integration Hub) | MISSING | Docs describe an `IntegrationsModule`/`integrations` schema/`ErpAdapter`/`EmailAdapter` pattern/API keys in full detail; none exists in code | Generic, provider-agnostic foundation | P0/P1 | none — fully buildable on existing Postgres/Redis/BullMQ | RM-20 (outbound dispatch), RM-21 (inbound receiver), RM-22 (API-key auth) | Medium / Medium / Small-Medium | none — zero-cost, self-hosted, unblocked |

## 12. Platform

| Requirement | State | Existing implementation | Remaining gap | Priority | Dependency | Proposed story | Complexity | Blocking decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Arabic & English | COMPLETE | `next-intl`, 0 missing keys either app, real RTL (`<html dir>` + 124 logical-CSS occurrences + one documented physical-axis override) | — | — | — | — | — | none |
| Web and mobile friendly | PARTIAL | Structural safety net only (shared `Table`'s horizontal-scroll wrapper, fluid dialogs); ~11% of components use any breakpoint; the 3 busiest list screens and the primary nav use none | Purpose-built mobile layout for tables and nav | P1 | Reuse `@crm/ui` `Table` primitive — extend, don't replace | RM-10 (tables), RM-11 (nav) | Medium / Small-Medium | none |
| Multi-department | COMPLETE | `Department` + `Role.ticketVisibilityScope` enforced at query time | — | — | — | — | — | none |
| Multi-branch | COMPLETE | `Branch` + `TenantContext.requireBranchScope()` enforced identically across every domain module | — | — | — | — | — | none |
| Custom branding | COMPLETE | `BrandingConfig`, genuinely consumed by both web nav and portal header | — | — | — | — | — | none |
| *(additional finding)* Locale-routing test coverage | MISSING | No dedicated spec for `apps/{web,portal}/src/i18n/{request,routing}.ts`; only incidental coverage via other components' translated strings | Direct routing/locale-switch/fallback tests | P2 | none | RM-12 | Small | none |

---

**Cross-reference note on "BLOCKED" vs "MISSING."** A requirement is marked
`BLOCKED` only when the code is genuinely complete and the only remaining
obstacle is external (a credential, a vendor choice). Where code is simply
absent, it is marked `MISSING` even if an external decision would eventually
be needed to finish it (e.g. Email/WhatsApp/SMS) — the *engineering*
foundation for those is not blocked (see Phase 4 in `03-dependency-graph.md`),
only the specific provider adapter is.
