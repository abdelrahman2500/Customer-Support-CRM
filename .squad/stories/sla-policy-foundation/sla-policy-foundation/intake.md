> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/sla-policy-foundation/sla-policy-foundation/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** SLA & Automation

- **Feature slug (folder under `plans/`):** `sla-policy-foundation`

## Tracker (metadata only)

- **Tracker type:** `github`

- **Work item id:** ``

- **Work item type:** ``

- **Status:** ``

- **Assignee:** ``

- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

SLA Policy Foundation

---

## Description

Introduce the foundational SLA Policy domain for the CRM.

This story establishes a branch-scoped, permission-controlled way to define and manage SLA policies. It provides the foundational policy data that later SLA-processing stories can consume when calculating and enforcing ticket response and resolution targets.

The story should follow the existing architectural and implementation conventions established by the completed Project Foundation, Customer Management, and Ticketing stories.

The first SLA story must remain a foundation story. It should establish the SLA Policy management boundary without prematurely implementing the runtime automation infrastructure described for the broader SLA & Automation domain.

The existing Ticketing domain is already complete through Story 09 and provides the relevant ticket concepts and domain-event foundation. Story 10 may establish the SLA Policy domain independently of the ticket-event processing that will consume those policies later.

Branch isolation, authentication, authorization, and error behavior must follow the existing CRM conventions rather than introducing a new security or tenancy model.

No unrelated domain should be changed unless a genuinely shared dependency is required by the chosen SLA Policy scope.

---

## Acceptance criteria

- [ ] A dedicated SLA domain is introduced according to the existing architecture boundaries.

- [ ] An `SlaPolicy` model is introduced in the `sla` schema.

- [ ] The SLA Policy model supports the policy-scoping dimensions defined by the existing SLA architecture:
  - branch
  - department
  - ticket category
  - ticket priority

- [ ] SLA policies are branch-scoped and respect the existing `TenantContext` tenancy conventions.

- [ ] Authenticated users must have the appropriate SLA permissions to perform SLA Policy operations.

- [ ] The SLA permission catalog is extended only with the minimum permissions required for the story.

- [ ] Authorized users can create an SLA Policy within their branch scope.

- [ ] Authorized users can read SLA Policies within their branch scope.

- [ ] Authorized users can update an SLA Policy within their branch scope.

- [ ] An SLA Policy belonging to another branch is not exposed through the API.

- [ ] Out-of-scope or nonexistent SLA Policy resources follow the existing 404 behavior used by Customer Management and Ticketing.

- [ ] The implementation follows the existing authentication and authorization conventions:
  - `AuthGuard`
  - `PermissionsGuard`
  - `@RequirePermissions(...)`
  - `TenantContext`

- [ ] The implementation follows the established service, controller, Prisma, and testing conventions already used by the existing domains.

- [ ] A required Prisma migration is created and is additive.

- [ ] Unit tests cover the SLA Policy service behavior.

- [ ] E2E tests cover the important authorization and branch-isolation behavior.

- [ ] Existing regression tests continue to pass.

- [ ] If the permission seed catalog is changed, running the seed process repeatedly remains idempotent.

- [ ] The story does not modify the existing Ticket event contract.

- [ ] The story does not require BullMQ, Socket.IO, CASL, or a new authentication mechanism.

---

## Attachments

| File (relative to this folder) | What it is |
| ------------------------------ | ---------- |
| None.                          |            |

---

## Dependencies

- **Blocked by / related ids:**
  - None.

- **Depends on code areas or other stories:**
  - Project Foundation — Stories 01–05: existing authentication, authorization, tenancy, Prisma, seed, and testing conventions.
  - Customer Management — Story 06: existing branch-scoped domain patterns and Department/Customer-related domain foundations.
  - Ticketing — Stories 07–09: existing Ticket model and Ticketing domain foundations, including category and priority concepts and the established domain-event infrastructure.

The required prerequisite stories are already complete.

---

## Extra notes (optional)

- Story 10 was selected as **SLA & Automation** after a repository-level candidate evaluation following Story 09.

- This is a human-confirmed roadmap decision, not a previously existing Story 10 definition in the repository.

- The architecture identifies SLA & Automation as a separate domain and describes SLA policies, target computation, business-hours handling, and scheduled SLA processing as parts of the broader domain.

- Story 10 intentionally focuses on the **SLA Policy foundation** and should not implement the complete SLA automation lifecycle.

- The existing `ticket.created` and `ticket.updated` events remain available for future SLA processing stories.

- The existing event contract should remain unchanged unless a concrete requirement for this story is established during planning.

- Do not infer undocumented field names, API routes, DTO shapes, or SLA calculation rules from this intake. Those details must be resolved during planning from the repository's architecture documentation and existing implementation conventions.

---

## Technical hints (optional)

- Primary language: `typescript`
- Repository root: `.`
- Existing backend: `apps/api`
- Existing Prisma schema: `apps/api/prisma/schema.prisma`
- Existing tenancy mechanism: `TenantContext`
- Existing authorization mechanism: `AuthGuard`, `PermissionsGuard`, `@RequirePermissions(...)`
- Existing permission catalog: `apps/api/prisma/seed.ts`
- Existing testing patterns:
  - service unit tests using hand-built mocks
  - E2E tests using the real `AppModule` and real database infrastructure
- Follow the existing domain module structure under `apps/api/src/modules/`.

Important: these are architectural/implementation hints only. The plan must inspect the repository's existing conventions before deciding exact model fields, routes, DTOs, permissions, or other implementation details.

---

## Out of scope

- SLA target computation for tickets.
- `ticket.created` SLA processing/listener.
- `ticket.updated` SLA processing/listener.
- `ticket.recategorized` event creation.
- Changes to the existing Ticket event payload.
- Business-hours calendar implementation.
- Holiday calendar implementation.
- SLA timers.
- BullMQ or scheduled SLA jobs.
- SLA breach detection.
- SLA at-risk detection.
- SLA escalation processing.
- `ticket.escalated`.
- Notification delivery.
- Socket.IO or realtime functionality.
- Automation rules.
- Customer Portal.
- Communication / Channels.
- Knowledge Base.
- Reporting & Analytics.
- AI Services.
- Integrations.
- `Ticket.externalRef`.
- CASL.
- Changes to `.squad/config.yaml`.
- Changes to unrelated existing domains.
- Changes to `admin.audit_logs` or `AuditInterceptor`.
- Speculative generic abstractions.
