**Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

- Folder: `.squad/stories/machine-facing-reporting-api-key/machine-facing-reporting-api-key/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

`machine-facing-reporting-api-key`

Integrations domain (`docs/architecture/09-integrations.md`), consuming the
Reporting & Analytics domain read-only.

## Tracker (metadata only)

- Type: `github`
- Work item id: _(none — entered manually, not linked)_

## Title

Machine-facing reporting endpoint authenticated by API key

## Description

RM-22 shipped a complete API-key authentication stack — an `ApiKey` model,
HMAC-hashed storage, issue/revoke endpoints, a scope vocabulary, and a global
`ApiKeyGuard` that binds the caller's branch from the durable key row. It
shipped with **zero real registrations**: a repository-wide search confirms
`@AllowApiKey()` appears on exactly one route in the whole API,
`apps/api/src/test-fixtures/test-machine-route.controller.ts:35`, which is a
test fixture registered only by `test/api-keys.e2e-spec.ts` and never by
`app.module.ts`.

Both `README.md`'s roadmap and `docs/ASSESSMENT-EVIDENCE.md` name this as a
real, open gap: *"the guard is implemented and unit-tested (RM-22), but no
real business endpoint currently accepts one."* Decision Record 4 in
`.squad/plans/core-completion-roadmap/02-product-decisions.md` classifies
API-key/M2M authentication as **"fully unblocked and zero-cost"** — unlike
RM-16/17/18 and the ERP adapters, this needs no external provider decision.

This story closes that gap with the smallest possible real surface: **one
read-only JSON reporting endpoint.**

## Why a separate route rather than decorating an existing one

An audit of the guard chain established that the two natural candidates both
collide with existing guard composition, and that this collision is the real
reason RM-22 never registered a route:

- **Every `/reports/*` route carries `@RequirePermissions("report:read")`.**
  `PermissionsGuard` runs *before* `ApiKeyGuard` in `app.module.ts`, and with
  no JWT it hits `if (!user) return false` (`permissions.guard.ts:37-39`) —
  a 403 before `ApiKeyGuard` ever executes. `ApiKeyGuard`'s own doc comment
  states the rule outright: *"no route reachable via `@AllowApiKey()` may
  also declare `@RequirePermissions(...)`."*
- **The web-form intake route is `@Public()`**, and `ApiKeyGuard` does not
  check `IS_PUBLIC_KEY` — adding `@AllowApiKey()` there would make the guard
  demand a bearer token from anonymous callers, breaking Story 87's shipped
  public contract. It is also not tenant-bound (`branchId` comes from the
  request body), so a key would add no isolation there.

The chosen resolution is a **separate machine-facing route** that simply does
not declare `@RequirePermissions`. It changes no existing route, no guard, and
no guard ordering — the only option of the four considered that leaves every
completed Story's behaviour untouched.

## Acceptance criteria

### Route

- A new `GET /api/v1/integrations/reports/ticket-volume` exists, under the
  same `integrations/*` prefix the four existing integrations controllers
  already use.
- It is a **real production route**, registered through `ReportingModule` in
  `app.module.ts` — not a test fixture.
- It returns the same JSON shape as the existing
  `GET /api/v1/reports/ticket-volume`: `TicketVolumeByStatus[]`.
- **No CSV/export variant** and **no other report family** is exposed.

### Reuse, not duplication

- The handler delegates to the existing
  `ReportingService.getTicketVolumeByStatus(filters)`. **No query or business
  logic is copied, and `ReportingService` is not modified.**
- The existing module-level `toFilters()` in `reporting.controller.ts` is
  `export`ed and reused rather than duplicated. That is the only change to
  that file — no route, decorator, or behaviour change.

### Authentication and authorization

- Decorated `@AllowApiKey()` + `@RequireApiKeyScope("integration:read")`.
- **No `@RequirePermissions()`** — that is the entire point of the separate
  route.
- Uses the existing `integration:read` from `API_KEY_SCOPES`. **No new scope
  is added.**
- A key holding only `integration:write` → **403**.
- A revoked key → **401**. An expired key → **401**. No credentials → **401**.
- A normal agent JWT still works on this route (`AuthGuard` authenticates,
  `ApiKeyGuard` no-ops because `request.user` is set).

### Tenant isolation

- Branch scoping flows through the existing mechanism only:
  `ApiKeyGuard` sets `request.tenantClaims.branchId` from the durable `ApiKey`
  row; `TenantContext` (`Scope.REQUEST`, lazy getters) reads it; 
  `ReportingService.resolveBranchFilter` calls `requireBranchScope()`.
- A key bound to branch A must never see branch B's tickets.
- `ApiKey.branchId` is non-nullable in the schema, so `requireBranchScope()`
  cannot throw its raw `Error` for a valid key.

### `crossBranch` behaviour

- The route reuses `ReportDateRangeQueryDto` unchanged, so `crossBranch` is
  accepted at validation.
- With an API key, `crossBranch=true` must be **safely rejected with 403**:
  `resolveBranchFilter` looks up `report:read-cross-branch` against
  `tenantContext.roles`, and `ApiKeyGuard` sets `roles: []` deliberately, so
  the lookup finds nothing and throws `ForbiddenException`. This requires no
  new code and must be pinned by a test.

### Non-regression

- `/api/v1/reports/*` routes unchanged.
- `PermissionsGuard`, `ApiKeyGuard`, `AuthGuard`, `AudienceGuard` unchanged.
- Guard registration order in `app.module.ts` unchanged.
- `apps/api/test/reporting.e2e-spec.ts` (47 tests) and
  `apps/api/test/api-keys.e2e-spec.ts` pass **unchanged** — if either needs
  editing, the design is wrong.

## Attachments

_(none)_

## Dependencies

- **RM-22** (`bafc128`) — `ApiKey` model, `ApiKeyGuard`, `@AllowApiKey()`,
  `@RequireApiKeyScope()`, `API_KEY_SCOPES`, `ApiKeyHasher`.
- **Story 56 / RM-07** — `ReportingService`, `ReportFilters`, `toFilters()`,
  `resolveBranchFilter` and its `report:read-cross-branch` gate.
- **Story 03 / identity** — `TenantContext`, `TenantMiddleware`, the global
  guard chain.

## Extra notes (optional)

- The report chosen is **ticket volume by status** specifically because its
  payload is a pure aggregate (`{ status, count }[]`) containing **no PII** —
  no names, emails, ticket subjects or agent identities. That matters for a
  credential that lives in an external system. `agent-performance` would leak
  agent identities and `csat` free-text comments; neither belongs in the
  first machine surface.
- This is the smallest real registration that proves the whole RM-22 stack
  end to end against production wiring rather than a fixture.

## Technical hints (optional)

- `test-fixtures/test-machine-route.controller.ts` is the closest shape
  precedent (`@Get` + `@AllowApiKey()` + `@RequireApiKeyScope("integration:read")`),
  but it reads `req.tenantClaims` directly. The new route must instead let
  `ReportingService`/`TenantContext` do the scoping, which is what makes it a
  real integration rather than a fixture.
- `ReportingModule` already provides `ReportingService` and `TenantContext`;
  the new controller only needs adding to its existing `controllers: []`.
- Guard-chain trace for an API-key request on this route, verified against
  source: `AuthGuard` (allowsApiKey → try/catch → `true`) → `AudienceGuard`
  (no user → `true`) → `PermissionsGuard` (no `@RequirePermissions` → `true`
  at the first check, never reaching the `!user` branch) → `ApiKeyGuard`
  (authenticates, checks scope, sets `tenantClaims`).

## Out of scope

- Any change to the existing `/api/v1/reports/*` routes, including their
  `@RequirePermissions("report:read")`.
- Any change to `PermissionsGuard`, `ApiKeyGuard`, `AuthGuard`,
  `AudienceGuard`, or guard registration order.
- Any change to `ReportingService`'s query or business logic.
- CSV/export access for machine callers.
- Exposing the other report families (sla-compliance, csat,
  agent-performance, ticket-aging, resolution-time, ticket-volume-by-category,
  ai-usage) — a later story can widen the surface once this one proves the
  pattern.
- Adding a new API-key scope, or changing `API_KEY_SCOPES`.
- Any schema change or migration.
- Wiring API keys to the web-form intake route, or to any write endpoint.
- Rate limiting specific to machine callers (the global `ThrottlerGuard`
  default applies unchanged).
