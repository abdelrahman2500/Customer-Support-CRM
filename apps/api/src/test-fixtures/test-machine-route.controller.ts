import { Controller, Get, Req } from "@nestjs/common";
import type { Request } from "express";
import { AllowApiKey } from "../common/auth/allow-api-key.decorator";
import { RequireApiKeyScope } from "../common/auth/require-api-key-scope.decorator";

/**
 * RM-22 — the ONE "explicitly-allowlisted machine-callable route" the
 * plan's own acceptance criteria describe — registered only by
 * `test/api-keys.e2e-spec.ts` (never by `app.module.ts`/any real module,
 * so it is dead code with zero production route surface). Mirrors
 * RM-14's/RM-21's own "ship the framework, zero real registrations"
 * precedent as literally as this story's own shape allows: RM-14/21
 * register an empty adapter/verifier registry inside real production
 * code; here there is no real business route of this story's own to
 * decorate at all, so the test registers its own instead of inventing
 * one that would ship to production unused.
 *
 * Lives under `src/test-fixtures/`, not `apps/api/test/`: Vitest's SSR
 * transform of a file matched by (or imported from) the `test/**` glob
 * does not accept parameter-decorator syntax (`@Req()`) — confirmed by
 * reproducing the exact parse failure both inline in the spec file and in
 * its own file under `test/`. Every decorated class living under `src/`
 * (imported normally, exactly like every real controller) transforms
 * identically to production code, which is the only reason this fixture
 * is placed here instead.
 *
 * Reads `request.tenantClaims` directly (rather than injecting the
 * request-scoped `TenantContext`, which every other module explicitly
 * re-provides itself — this ad-hoc test module would need to as well) to
 * prove `ApiKeyGuard` resolved the caller's branch/user correctly.
 */
@Controller("test/machine-route")
export class TestMachineController {
  @Get()
  @AllowApiKey()
  @RequireApiKeyScope("integration:read")
  get(@Req() req: Request): { ok: true; branchId: string | null; userId: string | null } {
    return {
      ok: true,
      branchId: req.tenantClaims?.branchId ?? null,
      userId: req.tenantClaims?.userId ?? null,
    };
  }
}
