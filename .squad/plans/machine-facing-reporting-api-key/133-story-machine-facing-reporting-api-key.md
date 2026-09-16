# Story 133 — Machine-facing reporting endpoint authenticated by API key

## Prerequisites

- **RM-22 completed** — [`../core-completion-roadmap/RM-22-api-key-auth.md`](../core-completion-roadmap/RM-22-api-key-auth.md), commit `bafc128`. Shipped `ApiKey` (`integrations` schema, non-nullable `branchId`), `ApiKeyHasher`, `ApiKeysController`/`Service` (issue/revoke), `API_KEY_SCOPES = ["integration:read", "integration:write"]`, `@AllowApiKey()`, `@RequireApiKeyScope()`, and the global `ApiKeyGuard`. **This story consumes that mechanism; it must not modify any part of it.**
- **Story 56 / RM-07 completed** — `ReportingService`, `ReportFilters`, `ReportingController`'s module-level `toFilters()`, and `resolveBranchFilter`'s `report:read-cross-branch` gate.
- **Story 03 / identity completed** — `TenantContext` (`Scope.REQUEST`), `TenantMiddleware`, and the global guard chain in `app.module.ts`.

**Baseline commit for every line reference below:** `7fe7746`. Re-verify any line number that has drifted.

---

## Story Goal

Give RM-22's API-key stack its **first real production route**, without touching a single existing route or guard.

1. **One endpoint.** `GET /api/v1/integrations/reports/ticket-volume`, returning the same `TicketVolumeByStatus[]` JSON the human route already returns.
2. **Reuse, not duplication.** The handler delegates to the existing `ReportingService.getTicketVolumeByStatus(filters)` and the existing `toFilters()` mapper. No query logic is copied.
3. **Zero blast radius.** No change to `/reports/*`, to any guard, or to guard ordering. The separate route exists precisely so that none of those need to change.
4. **Isolation inherited, not re-implemented.** Branch scoping flows entirely through `ApiKeyGuard → request.tenantClaims → TenantContext.requireBranchScope()`.

**Not in scope** (each an intake "Out of scope" item):

- Any change to `/api/v1/reports/*`, including their `@RequirePermissions("report:read")`.
- Any change to `PermissionsGuard`, `ApiKeyGuard`, `AuthGuard`, `AudienceGuard`, or guard registration order.
- Any change to `ReportingService`'s query or business logic.
- CSV/export for machine callers.
- Any other report family — `sla-compliance`, `csat`, `agent-performance`, `ticket-aging`, `resolution-time`, `ticket-volume-by-category`, `ai-usage`.
- A new API-key scope, or any change to `API_KEY_SCOPES`.
- Any schema change or migration.
- Machine-specific rate limiting — the global `ThrottlerGuard` default applies unchanged.

---

## Context — Read These Files First

1. **`apps/api/src/common/auth/api-key.guard.ts`** — the whole doc comment (lines ~20–50), especially the two rules this story depends on: the guard is a **complete no-op** on any route without `@AllowApiKey()`, and *"no route reachable via `@AllowApiKey()` may also declare `@RequirePermissions(...)`"*. Also `canActivate`'s tail, where it sets `request.tenantClaims` from the `ApiKey` row with `roles: []`.
2. **`apps/api/src/common/auth/permissions.guard.ts`** lines 26–40 — `if (!required || required.length === 0) return true;` comes **first**, before the `if (!user) return false;` at 37–39. This is exactly why a route with no `@RequirePermissions` passes this guard cleanly with no JWT, and why the separate route works without modifying the guard.
3. **`apps/api/src/app.module.ts`** lines ~65–81 — the guard order and its doc comment. Read it to confirm nothing here needs to change.
4. **`apps/api/src/modules/reporting/reporting.controller.ts`** lines 28–37 — `toFilters()`, the only thing this story edits in that file (adding `export`). Note the surrounding comment: every one of the 16 routes builds its filters through it.
5. **`apps/api/src/modules/reporting/reporting.service.ts`** ~222–246 — `resolveBranchFilter`: `requireBranchScope()` first, then the `report:read-cross-branch` lookup against `this.tenantContext.roles` that produces the 403 for a key.
6. **`apps/api/src/common/tenant/tenant-context.ts`** — `Scope.REQUEST` with **lazy getters** reading `request.tenantClaims`. This is why a guard-written value is visible to the service.
7. **`apps/api/src/test-fixtures/test-machine-route.controller.ts`** — the shape precedent. Note what this story does *differently*: the fixture reads `req.tenantClaims` directly to prove the guard resolved it; the real route must instead let `TenantContext`/`ReportingService` do the scoping.

---

## Product rules (from story)

- The route is **read-only** and **JSON only**.
- It is reachable by **either** a valid API key with `integration:read` **or** a normal agent JWT — the latter unchanged, because `AuthGuard` authenticates it and `ApiKeyGuard` then no-ops.
- A key can only ever see **its own branch's** data.
- `crossBranch=true` from a key is **403**, produced by existing code, not new code.
- Existing reporting and API-key tests must pass **unchanged**.

---

## Backend Tasks

### 1 — Export the existing filter mapper

`apps/api/src/modules/reporting/reporting.controller.ts`, line 28:

```diff
-function toFilters(dto: ReportDateRangeQueryDto): ReportFilters {
+export function toFilters(dto: ReportDateRangeQueryDto): ReportFilters {
```

**One word. Nothing else in this file changes** — no route, no decorator, no `@RequirePermissions`, no behaviour. Extend the existing doc comment by a sentence noting Story 133 reuses it, so the next reader knows why it is exported.

### 2 — The machine-facing controller

New file `apps/api/src/modules/reporting/machine-reporting.controller.ts`:

```ts
@ApiTags("integrations")
@ApiBearerAuth()
@Controller("integrations/reports")
export class MachineReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get("ticket-volume")
  @AllowApiKey()
  @RequireApiKeyScope("integration:read")
  getTicketVolume(@Query() query: ReportDateRangeQueryDto): Promise<TicketVolumeByStatus[]> {
    return this.reportingService.getTicketVolumeByStatus(toFilters(query));
  }
}
```

The doc comment must record, for the next reader:

- **Why a second controller exists at all** — `PermissionsGuard` runs before `ApiKeyGuard`, so a route cannot carry both `@RequirePermissions` and `@AllowApiKey`. This controller is the resolution that leaves `/reports/*` untouched.
- **Why there is deliberately no `@RequirePermissions` here** — so nobody "fixes" its absence and silently makes the route unreachable by key.
- **Why `ticket-volume` specifically** — a pure aggregate with no PII, unlike `agent-performance` or `csat`.
- **Why the handler does no scoping of its own** — `ReportingService` already scopes via `TenantContext`, which `ApiKeyGuard` populates.
- **Prefix choice** — `integrations/*`, matching the four existing integrations controllers.

### 3 — Register it

`apps/api/src/modules/reporting/reporting.module.ts`:

```diff
-  controllers: [ReportingController, DashboardsController],
+  controllers: [ReportingController, DashboardsController, MachineReportingController],
```

`ReportingService` and `TenantContext` are already provided in this module — **no provider change**. Note in the module's doc comment that this is a third controller in the same domain, mirroring the Story 110 `DashboardsController` precedent it already records.

### 4 — Nothing else

No change to `app.module.ts`, any guard, any decorator, `api-key-scopes.ts`, `ReportingService`, the DTO, the schema, or any migration.

---

## Edge Cases & Failure Modes

| Case | Required behaviour | Produced by |
| --- | --- | --- |
| Valid key, `integration:read` | **200**, same shape as `/reports/ticket-volume` | new route |
| Key with only `integration:write` | **403** "Missing required API key scope" | `ApiKeyGuard` (existing) |
| Revoked key | **401** | `ApiKeyGuard` (existing) |
| Expired key | **401** | `ApiKeyGuard` (existing) |
| No `Authorization` header | **401** "Missing credentials" | `ApiKeyGuard` (existing) |
| Unknown / malformed key | **401** | `ApiKeyGuard` (existing) |
| Key bound to branch A | Sees **only** branch A's tickets | `TenantContext` + `resolveBranchFilter` (existing) |
| `crossBranch=true` with a key | **403** — `roles: []` fails the `report:read-cross-branch` lookup | `resolveBranchFilter` (existing) |
| Agent JWT with `report:read` | **200** — human access unchanged | `AuthGuard`, then `ApiKeyGuard` no-ops |
| Agent JWT *without* `report:read` | **200** — this route has no `@RequirePermissions` by design | documented, asserted |
| Invalid `from`/`to` format | **400** from the existing DTO validation | `ReportDateRangeQueryDto` (existing) |

> **On the "Agent JWT without `report:read`" row:** this is a deliberate, disclosed consequence of the design, not an oversight. The machine route intentionally omits `@RequirePermissions`, so any authenticated agent can read this one aggregate. It is acceptable because the payload is a non-PII status/count roll-up of the caller's own branch, and because `/reports/ticket-volume` — the route humans actually use — keeps its permission check unchanged. **This must be stated in the controller's doc comment and pinned by a test**, so the trade-off is visible rather than discovered later.

---

## Test Plan

**No existing test may be modified.** If `reporting.e2e-spec.ts` or `api-keys.e2e-spec.ts` needs an edit, the design is wrong — stop and re-plan.

### Unit — `apps/api/src/modules/reporting/machine-reporting.controller.spec.ts` (new)

1. Delegates to `ReportingService.getTicketVolumeByStatus` with the mapped filters.
2. Maps `crossBranch: "true"` → `true` through the shared `toFilters` (proving reuse, not a private copy).
3. Returns the service's result unchanged.

### API e2e — `apps/api/test/machine-reporting.e2e-spec.ts` (new)

4. Valid key with `integration:read` → **200**, array of `{ status, count }`.
5. Response matches what `/reports/ticket-volume` returns for the same branch (proves shared logic, not a divergent copy).
6. Key with only `integration:write` → **403**.
7. Revoked key → **401**.
8. Expired key → **401**.
9. No credentials → **401**.
10. Unknown/garbage bearer token → **401**.
11. **Branch isolation** — a key bound to branch A does not see branch B's tickets. *The highest-value test in this story.*
12. `crossBranch=true` with a key → **403**.
13. Agent JWT with `report:read` → **200** (human access preserved).
14. `lastUsedAt` is updated after a successful call.

### Regression — must pass **unchanged**

- `apps/api/test/reporting.e2e-spec.ts` — 47 tests, especially `"rejects an Agent-role user lacking report:read on every route (403)"` (L293) with its seven `.expect(403)` assertions. Proves `/reports/*` still enforces permissions.
- `apps/api/test/api-keys.e2e-spec.ts` — proves the fixture route and the guard behave as before.
- `apps/api/src/common/auth/api-key.guard.spec.ts` — proves the guard is still a no-op on un-decorated routes.

---

## Verification Steps

```
npx vitest run src/modules/reporting/machine-reporting.controller.spec.ts
npx vitest run test/machine-reporting.e2e-spec.ts --no-file-parallelism
npx vitest run test/reporting.e2e-spec.ts test/api-keys.e2e-spec.ts --no-file-parallelism
pnpm --filter @crm/api test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

**Known pre-existing failures that are NOT this story's** (do not fix here):

- `reporting.e2e-spec.ts` lines 868 and 1041 — assert zero tickets dated *yesterday*; the shared dev DB holds ~85 such rows from accumulated fixtures. Proven pre-existing and unrelated at commit `7fe7746`. **Expect these two to fail; they are not a Story 133 regression.** Every *other* test in that file must pass.
- The four disclosed `identity.e2e-spec.ts` isolation defects (CLAUDE.md §13).

---

## Documentation

- **`README.md`** — the Integration Hub roadmap bullet says *"wiring the existing, tested API-key guard to at least one real endpoint"*. That is now done; narrow the bullet to what genuinely remains (inbound-webhook verifier, payload→ticket translation, ERP adapters).
- **`docs/ASSESSMENT-EVIDENCE.md`** — the deferred-scope row reading *"no real business endpoint currently accepts one — only an internal test fixture exercises it"* becomes false. Correct it, citing the new route.
- **`docs/architecture/09-integrations.md`** — one line recording the machine-callable reporting surface and its `integration:read` scope.

Do **not** claim a broader machine API than one read-only endpoint.

---

## Done Criteria

- [ ] `GET /api/v1/integrations/reports/ticket-volume` exists as a real production route registered through `ReportingModule`.
- [ ] Decorated `@AllowApiKey()` + `@RequireApiKeyScope("integration:read")`, with **no** `@RequirePermissions()`.
- [ ] Delegates to the existing `ReportingService.getTicketVolumeByStatus`; no query logic duplicated; `ReportingService` unmodified.
- [ ] `toFilters()` exported and reused; that is the only change to `reporting.controller.ts`.
- [ ] No new API-key scope; `API_KEY_SCOPES` unchanged.
- [ ] No CSV/export; no other report family exposed.
- [ ] `/reports/*`, `PermissionsGuard`, `ApiKeyGuard`, `AuthGuard`, `AudienceGuard` and guard ordering all unchanged.
- [ ] No schema change, no migration.
- [ ] Branch isolation proven by test; `crossBranch=true` → 403 proven by test.
- [ ] Human JWT access preserved and proven by test.
- [ ] `reporting.e2e-spec.ts` and `api-keys.e2e-spec.ts` pass **unedited** (modulo the two disclosed pre-existing reporting failures).
- [ ] README / ASSESSMENT-EVIDENCE / 09-integrations.md updated, claiming no more than one read-only endpoint.
- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm build` clean.
