import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AllowApiKey } from "../../common/auth/allow-api-key.decorator";
import { RequireApiKeyScope } from "../../common/auth/require-api-key-scope.decorator";
import { ReportDateRangeQueryDto } from "./dto/report-date-range-query.dto";
import { toFilters } from "./reporting.controller";
import type { TicketVolumeByStatus } from "./reporting.service";
import { ReportingService } from "./reporting.service";

/**
 * Story 133 — the first REAL production route reachable by an API key.
 *
 * RM-22 (`bafc128`) shipped the whole API-key stack — `ApiKey`, HMAC
 * hashing, issue/revoke, `API_KEY_SCOPES`, and the global `ApiKeyGuard` —
 * and deliberately shipped it with zero real registrations, mirroring
 * RM-14's and RM-21's own "ship the framework, register nothing"
 * precedent. Until this story the only `@AllowApiKey()` in the repository
 * was `src/test-fixtures/test-machine-route.controller.ts`, a fixture
 * registered solely by `test/api-keys.e2e-spec.ts`.
 *
 * ## Why this is a second controller instead of a decorator on `/reports/*`
 *
 * `app.module.ts` registers the guards in the order `AuthGuard` ->
 * `AudienceGuard` -> `PermissionsGuard` -> `ApiKeyGuard`. `PermissionsGuard`
 * therefore runs BEFORE any API key has been authenticated, and with no
 * `request.user` it returns `false` outright (`permissions.guard.ts`, the
 * `if (!user)` branch). So a route carrying BOTH `@RequirePermissions(...)`
 * and `@AllowApiKey()` is unreachable by key — `ApiKeyGuard`'s own doc
 * comment states exactly that rule. Every `/reports/*` route carries
 * `@RequirePermissions("report:read")`.
 *
 * A separate route that simply omits that decorator is the one resolution
 * that changes no existing route, no guard, and no guard ordering. The
 * alternatives all cost more: removing `@RequirePermissions` from a shared
 * route would drop the human RBAC check too, and teaching `PermissionsGuard`
 * or reordering the chain would alter behaviour four completed stories
 * depend on.
 *
 * ## `@RequirePermissions` is absent ON PURPOSE — do not "fix" it
 *
 * Adding one here would make this route unreachable by the very credential
 * it exists to serve, for the reason above. Authorization for a key is
 * `@RequireApiKeyScope("integration:read")`, enforced by `ApiKeyGuard`.
 *
 * The disclosed consequence: an agent JWT *without* `report:read` can also
 * read this one endpoint. That is accepted, not overlooked — the payload is
 * a non-PII status/count roll-up of the caller's own branch, and
 * `/reports/ticket-volume`, the route humans actually use, keeps its
 * permission check unchanged. A test pins this so the trade-off stays
 * visible.
 *
 * ## Why `ticket-volume` and nothing else
 *
 * Its payload is a pure aggregate (`{ status, count }[]`) carrying no PII —
 * no names, emails, ticket subjects or agent identities. That matters for a
 * credential living in an external system. `agent-performance` would expose
 * agent identities and `csat` free-text comments; neither belongs in the
 * first machine surface. Widening to more report families, or to the CSV
 * exports, is a later story's decision once this pattern is proven.
 *
 * ## Tenant isolation is inherited, not re-implemented here
 *
 * This handler does no scoping of its own by design. `ApiKeyGuard` resolves
 * `branchId` once from the durable `ApiKey` row (never from anything the
 * caller sends) into `request.tenantClaims`; `TenantContext` is
 * `Scope.REQUEST` and reads it through lazy getters, so a guard-written
 * value is visible by the time `ReportingService.resolveBranchFilter` calls
 * `requireBranchScope()`. `ApiKey.branchId` is non-nullable in the schema,
 * so that call cannot throw for a valid key.
 *
 * `crossBranch=true` is accepted by the shared DTO and then safely refused:
 * `resolveBranchFilter` checks `report:read-cross-branch` against
 * `tenantContext.roles`, and `ApiKeyGuard` sets `roles: []` deliberately, so
 * the lookup finds nothing and throws `ForbiddenException` -> 403. No new
 * code produces that; a test pins it so neither side can later widen a key's
 * reach across branches unnoticed.
 *
 * Route prefix `integrations/*` matches the four existing integrations
 * controllers (`integrations/api-keys`, `integrations/webhooks`,
 * `integrations/webhook-subscriptions`, `integrations/webhook-inbound-logs`),
 * so "machine surface" is signalled by an established convention rather than
 * a new one. The controller lives in `ReportingModule` because that is where
 * `ReportingService` and `TenantContext` are already provided — a third
 * controller in one domain module, exactly as Story 110 added
 * `DashboardsController` alongside `ReportingController`.
 */
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
