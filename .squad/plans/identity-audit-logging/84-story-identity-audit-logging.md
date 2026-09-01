# Story 84 — Explicit Audit Logging: Auth Events & Permission Diffs

## Prerequisites

- Story 02: `AuditLog` model (`admin.audit_logs`), `AuditInterceptor`
  (global, coarse "who did what to which route" logging).
- Story 37 (`audit-log-read-endpoint`): `AuditLogsService`/
  `AuditLogsController` (`GET /audit-logs`, branch-scoped), already
  returning every column this story writes (`actorId`, `diff`, etc.)
  unchanged.
- Stories 46/47/48: the exact `IdentityService` methods this story
  instruments (`setRolePermissions`, `updateRole`, `updateUserAssignment`,
  `resetPassword`) and the existing `login`/`refresh`/`revoke` auth flow.

All prerequisites are complete; the story is fully unblocked.

---

## Story Goal

`docs/architecture/05-auth-and-security.md`: *"A global NestJS
interceptor records mutating requests; services explicitly record
permission changes, exports, bulk operations, login/logout, and failed
authentication."* Only the first half is true today. This story adds the
missing explicit writes, all inside `IdentityService` (the interceptor's
own doc comment already names this file's methods as one of the intended
explicit-write call sites, "as documented in
docs/architecture/05-auth-and-security.md"):

1. **Failed authentication** — `login()`'s two `UnauthorizedException`
   branches (unknown/inactive user, wrong password) each write an
   `action: "auth.login_failed"` row first.
2. **Successful login** — `login()`'s success path writes `action:
   "auth.login"` with the real `actorId` (impossible for the global
   interceptor, since `/auth/login` is `@Public()` and `request.user` is
   never populated there).
3. **Logout** — `revoke()` writes `action: "auth.logout"` with the real
   `actorId`, only when a still-active token was actually revoked
   (mirrors `revoke`'s own existing "silently no-ops if already gone"
   convention — no log entry for a no-op).
4. **Permission/role changes**, each with a real `diff: { before, after
   }`:
   - `setRolePermissions` → `action: "role.permissions_updated"`.
   - `updateRole` → `action: "role.updated"`.
   - `updateUserAssignment` → `action: "user.reassigned"`.
5. **`resetPassword`** → `action: "user.password_reset"` (no `diff` —
   there is no before/after value that makes sense for a password;
   its own privilege-relevant side effect, revoking every refresh token,
   is already covered by the action name itself).

**Not in scope:** `refresh()` (token rotation is not named in the
architecture doc's list — only login/logout — and would add one audit
row per silent background refresh, pure noise); exports/bulk operations
(no such feature exists anywhere in this codebase yet); any change to
`AuditLogsService`/`AuditLogsController`/the `AuditLog` schema (both
already support everything this story writes); "impersonation data"
(mentioned in the same doc line, but no impersonation feature exists in
this codebase at all — nothing to instrument).

---

## Design decisions

1. **No new shared service/module.** `AuditInterceptor`'s own doc
   comment already prescribes the pattern: *"Feature modules that need a
   real before/after diff... call `PrismaService.auditLog.create(...)`
   explicitly from their own service."* `IdentityService` already
   injects `PrismaService` — this story adds a small private
   `recordAuditLog` helper *inside* `IdentityService` (not a new
   cross-cutting abstraction) that wraps `this.prisma.auditLog.create`
   with the same catch-and-log-never-throw convention the interceptor
   itself already uses (audit logging must never break the request it's
   observing).
2. **Failed-login attribution.** There is no authenticated actor for a
   failed login — `actorId` stays `null` (the schema's own `actorId
   String?` already anticipates this). The *attempted* target goes in
   `entityId` instead: the real user id when the account was found (the
   "wrong password" branch), or the raw attempted email when no such
   account exists at all (the "unknown/inactive user" branch) — this
   never changes `login`'s own documented behavior of returning an
   identical, non-distinguishing `401` either way; it only affects an
   internal, `audit:read`-gated log row, never the HTTP response.
3. **`login`/`revoke` gain a trailing, optional `ipAddress: string |
   null = null` parameter** (not a breaking signature change — every
   existing call site, including every existing unit test, keeps
   compiling unchanged). `IdentityController.login` gains `@Req()
   request: Request` (it currently has none) to pass `request.ip`
   through; `logout`/already has `@Req()` and now forwards `request.ip`
   into `revoke(...)`.
4. **Diff shape.** A plain `{ before: {...}, after: {...} }` object,
   `before` read from state each method already has in hand before its
   own mutation (or one extra, cheap lookup — `setRolePermissions`
   didn't previously read the role's existing permissions at all, since
   it unconditionally deletes-then-recreates; this story adds that one
   read specifically to compute the diff). `after` is the same
   effective values the method itself just wrote (falling back to the
   prior value for any field the DTO didn't touch — a partial `PATCH`
   never appears in the diff as "changed to undefined").

---

## Context — Read These Files First

1. `docs/architecture/05-auth-and-security.md` lines 15–19 ("Audit
   logging") — the exact, complete requirement this story closes.
2. `apps/api/src/common/audit/audit.interceptor.ts` (whole file, 61
   lines) — confirms the `tap()`-only-on-success behavior, the
   `@Public()`-route blind spot, and the doc comment this story's own
   design decision 1 quotes directly.
3. `apps/api/src/modules/identity/identity.service.ts` (whole file) —
   `login`, `revoke`, `updateUserAssignment`, `updateRole`,
   `setRolePermissions`, `resetPassword` are the six methods gaining a
   `recordAuditLog` call; `revokeAllRefreshTokens` (already called by
   `resetPassword`) is unchanged.
4. `apps/api/src/modules/identity/identity.controller.ts` (whole file)
   — `login` gains `@Req()`; `logout` (already has it) forwards
   `request.ip` into `revoke`.
5. `apps/api/src/common/tenant/tenant-context.ts` — `TenantContext.
   userId` (already used elsewhere, e.g. `tickets.service.ts`) is the
   `actorId` source for every already-authenticated method in this
   story (everything except `login`/`revoke`, which have no
   `TenantContext` yet at the point of failure/success).
6. `apps/api/prisma/schema.prisma` lines ~197–210 (`AuditLog`) — no
   changes; confirms `actorId`/`entityId`/`branchId`/`diff`/`ipAddress`
   are all already nullable/present.
7. `apps/api/src/modules/admin/audit-logs.service.ts` — confirms the
   read side already returns every field unchanged; no edit needed.
8. `apps/api/src/modules/identity/identity.service.spec.ts` (whole
   file, 1322 lines) — `buildPrismaMock`/`buildTenantContextMock`
   gain an `auditLog: { create: vi.fn() }` mock and a `userId` property
   respectively; the `login`/`revoke`/`updateUserAssignment`/
   `updateRole`/`setRolePermissions`/`resetPassword` describe blocks
   each gain new assertions, existing ones are otherwise unchanged
   (both `login`/`revoke` keep working with their existing 2-arg/1-arg
   call sites thanks to design decision 3's optional trailing param).

---

## Backend Tasks

### 1 — `IdentityService.recordAuditLog` helper

**File: `apps/api/src/modules/identity/identity.service.ts`**

```ts
private readonly logger = new Logger(IdentityService.name);

private async recordAuditLog(entry: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  branchId?: string | null;
  diff?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        branchId: entry.branchId ?? null,
        ...(entry.diff !== undefined ? { diff: entry.diff } : {}),
        ipAddress: entry.ipAddress ?? null,
      },
    });
  } catch (error) {
    // Mirrors AuditInterceptor's own convention exactly: audit logging
    // must never break the request it's observing.
    this.logger.error("Failed to write explicit audit log", error as Error);
  }
}
```

Import `Logger` from `@nestjs/common` (add to the existing import).
`Prisma` is already imported.

### 2 — `login` / failed authentication

```ts
async login(
  email: string,
  password: string,
  ipAddress: string | null = null,
): Promise<AuthTokenPair> {
  const user = await this.prisma.user.findUnique({
    where: { email },
    include: { branchRoles: { include: { role: true }, orderBy: { createdAt: "asc" } } },
  });

  if (!user || !user.isActive) {
    await this.recordAuditLog({
      actorId: null,
      action: "auth.login_failed",
      entityType: "user",
      entityId: user?.id ?? email,
      ipAddress,
    });
    throw new UnauthorizedException("Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    await this.recordAuditLog({
      actorId: null,
      action: "auth.login_failed",
      entityType: "user",
      entityId: user.id,
      ipAddress,
    });
    throw new UnauthorizedException("Invalid email or password");
  }

  const accessToken = await this.issueAccessToken(user.id, user.branchRoles);
  const { raw: refreshToken } = await this.createRefreshTokenRecord(user.id);
  await this.recordAuditLog({
    actorId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
    branchId: user.branchRoles[0]?.branchId ?? null,
    ipAddress,
  });
  return { accessToken, refreshToken };
}
```

### 3 — `revoke` / logout

```ts
async revoke(presentedToken: string, ipAddress: string | null = null): Promise<void> {
  const tokenHash = this.hashRefreshToken(presentedToken);
  const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  await this.prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (record && !record.revokedAt) {
    await this.recordAuditLog({
      actorId: record.userId,
      action: "auth.logout",
      entityType: "user",
      entityId: record.userId,
      ipAddress,
    });
  }
}
```

### 4 — `updateUserAssignment` diff

Immediately before the existing `try { await this.prisma.userBranchRole.
update(...) }`, capture `before` from the already-loaded `membership`;
after a successful update, record the diff:

```ts
const before = { roleId: membership.roleId, departmentId: membership.departmentId };
// ...existing validation/lockout-guard code, unchanged...
try {
  await this.prisma.userBranchRole.update({ where: { id: membership.id }, data: { /* unchanged */ } });
  await this.recordAuditLog({
    actorId: this.tenantContext.userId,
    action: "user.reassigned",
    entityType: "user",
    entityId: id,
    branchId,
    diff: {
      before,
      after: {
        roleId: dto.roleId ?? before.roleId,
        departmentId: dto.departmentId !== undefined ? dto.departmentId : before.departmentId,
      },
    },
  });
  return { id };
} catch (error) {
  throw translateDuplicateUserAssignment(error);
}
```

### 5 — `updateRole` diff

```ts
const before = {
  name: role.name,
  isActive: role.isActive,
  ticketVisibilityScope: role.ticketVisibilityScope,
};
// ...existing protected-role guard, unchanged...
try {
  await this.prisma.role.update({ where: { id }, data: { /* unchanged */ } });
  await this.recordAuditLog({
    actorId: this.tenantContext.userId,
    action: "role.updated",
    entityType: "role",
    entityId: id,
    diff: {
      before,
      after: {
        name: dto.name ?? before.name,
        isActive: dto.isActive ?? before.isActive,
        ticketVisibilityScope: dto.ticketVisibilityScope ?? before.ticketVisibilityScope,
      },
    },
  });
  return { id };
} catch (error) {
  throw translateDuplicateRoleName(error);
}
```

### 6 — `setRolePermissions` diff

Add one read before the existing delete-then-recreate transaction:

```ts
const existing = await this.prisma.rolePermission.findMany({
  where: { roleId: id },
  include: { permission: true },
});
const beforeKeys = existing.map((rp) => rp.permission.key).sort();
// ...existing uniqueKeys/permissions validation, unchanged...
await this.prisma.$transaction([/* unchanged */]);
await this.recordAuditLog({
  actorId: this.tenantContext.userId,
  action: "role.permissions_updated",
  entityType: "role",
  entityId: id,
  diff: { before: beforeKeys, after: [...uniqueKeys].sort() },
});
return { id };
```

### 7 — `resetPassword`

```ts
async resetPassword(id: string, dto: ResetPasswordDto): Promise<{ id: string }> {
  const existing = await this.prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundException("User not found");
  }

  const passwordHash = await hashPassword(dto.newPassword);
  await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  await this.revokeAllRefreshTokens(id);
  await this.recordAuditLog({
    actorId: this.tenantContext.userId,
    action: "user.password_reset",
    entityType: "user",
    entityId: id,
  });

  return { id };
}
```

### 8 — Controller: thread `ipAddress` through

**File: `apps/api/src/modules/identity/identity.controller.ts`**

```ts
@Public()
@Post("login")
@HttpCode(HttpStatus.OK)
async login(
  @Body() dto: LoginDto,
  @Req() request: Request,
  @Res({ passthrough: true }) response: Response,
): Promise<{ accessToken: string }> {
  const { accessToken, refreshToken } = await this.identityService.login(
    dto.email,
    dto.password,
    request.ip ?? null,
  );
  this.setRefreshCookie(response, refreshToken);
  return { accessToken };
}
```

`logout` (already has `@Req() request`) changes only its one call:
`await this.identityService.revoke(presented, request.ip ?? null);`.

---

## Edge Cases & Failure Modes

- **`auditLog.create` itself fails** (e.g. a transient DB blip): caught
  and logged by `recordAuditLog`, never propagated — a login/logout/
  permission-change request must never fail *because* its own audit
  entry couldn't be written, mirroring `AuditInterceptor`'s own
  documented rationale exactly.
- **An unknown email at login**: `entityId` is the raw attempted email
  (not a user id, since none exists) — never exposed via any HTTP
  response; visible only through `GET /audit-logs`, already
  `audit:read`-gated.
- **A `logout` call for an already-revoked or nonexistent token**: no
  audit row is written at all (mirrors `revoke`'s own pre-existing
  "silently no-ops" contract) — a repeated/replayed logout call is not
  itself an event worth auditing.
- **A partial `PATCH` to `updateRole`/`updateUserAssignment`** (e.g.
  only `isActive` changes): the diff's `after` still reports every
  field's *effective* value, with the untouched ones equal to `before`
  — never `undefined` — so a reader of the diff never has to guess
  whether an absent key meant "unchanged" or "cleared."
- **`setRolePermissions` given the exact same key set already
  assigned**: `before`/`after` in the diff are identical (sorted arrays
  compare equal) — still logged (the action genuinely happened, an
  explicit no-op `PATCH` is itself worth a record), consistent with
  every other write path in this story.

---

## Test Plan

1. **`apps/api/src/modules/identity/identity.service.spec.ts`**:
   - `buildPrismaMock` gains `auditLog: { create: vi.fn().mockResolvedValue({}) }`.
   - `buildTenantContextMock` gains a `userId` property (default
     `"actor-1"`, overridable).
   - `login`: new cases — writes `auth.login_failed` (`actorId: null`,
     `entityId: email`) for an unknown/inactive user; writes
     `auth.login_failed` (`entityId: user.id`) for a wrong password;
     writes `auth.login` (`actorId: user.id`, real `branchId`) on
     success; `ipAddress` flows through when passed.
   - `revoke`: writes `auth.logout` with the real `actorId` when a
     token was actually revoked; writes nothing when the token was
     already gone/revoked.
   - `updateUserAssignment`: writes `user.reassigned` with a correct
     `before`/`after` diff for a role change, a department change, and
     both together; never writes when the update itself fails
     validation (lockout guard, unknown role/department).
   - `updateRole`: writes `role.updated` with a correct diff for a
     rename, an activate/deactivate, and a `ticketVisibilityScope`
     change; never writes when blocked by the protected-role guard.
   - `setRolePermissions`: writes `role.permissions_updated` with
     correct `before`/`after` sorted key arrays, including the
     zero-existing-permissions and zero-new-permissions edge cases
     already covered by this describe block's existing tests.
   - `resetPassword`: writes `user.password_reset` with the caller's
     `actorId`.
2. **`apps/api/test/identity.e2e-spec.ts`** — new cases (mirroring this
   suite's own existing patterns): a failed login (wrong password)
   followed by `GET /audit-logs` (as the admin) shows an
   `auth.login_failed` entry; a real login/logout pair shows matching
   `auth.login`/`auth.logout` entries with the real user's id as
   `actorId`; a real `PATCH /identity/roles/:id/permissions` call
   shows a `role.permissions_updated` entry whose `diff.after` matches
   the submitted keys.

---

## Migration / Rollback

- No schema change at all — every column this story writes already
  exists (`AuditLog.actorId`/`entityId`/`branchId`/`diff`/`ipAddress`,
  all already nullable).
- **Rollback:** revert the six instrumented `IdentityService` methods
  and the controller's two `@Req()`/`ipAddress` threadings. No data
  loss — `admin.audit_logs` is append-only; removing the explicit
  writes just stops adding new rows of these specific `action` values,
  it never touches existing ones.

---

## Verification Steps

1. `pnpm --filter @crm/api typecheck`
2. `pnpm --filter @crm/api test`
3. `pnpm --filter @crm/api test:e2e` (or the isolated-file fallback
   Stories 79–83 documented, if the sandbox's Prisma consent gate blocks
   `migrate reset --force` again — this story runs no migration at all,
   so the fallback is lower-risk here than usual).
4. `pnpm typecheck && pnpm lint && pnpm build && pnpm test` (confirms
   `apps/web`/`apps/portal`/`apps/worker` remain unaffected — this story
   touches no frontend and no `apps/worker` code).

---

## Done Criteria

- [ ] A failed login (unknown/inactive user, or wrong password) writes
      an `auth.login_failed` `AuditLog` row with `actorId: null`.
- [ ] A successful login writes `auth.login` with the real `actorId` —
      something the global interceptor could never do for a `@Public()`
      route.
- [ ] A real logout writes `auth.logout` with the real `actorId`; a
      no-op logout (already-revoked/unknown token) writes nothing.
- [ ] `setRolePermissions`/`updateRole`/`updateUserAssignment` each
      write their own action with a real `before`/`after` `diff`.
- [ ] `resetPassword` writes `user.password_reset`.
- [ ] Audit-log writes never throw/propagate a failure into the
      request they're observing.
- [ ] No schema change; no change to `AuditLogsService`/
      `AuditLogsController`/`AuditInterceptor`.
- [ ] `refresh()` remains unchanged/uninstrumented (deliberately out of
      scope).
- [ ] Every item in `## Test Plan` is added/updated and passing.
- [ ] Every command in `## Verification Steps` passes.
- [ ] Every pre-existing test suite remains green, unweakened.
