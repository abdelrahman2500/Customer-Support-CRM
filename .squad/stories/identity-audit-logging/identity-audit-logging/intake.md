> **Source:** manual entry (tracker skipped via `--no-tracker`).
>
> Active tracker for this workspace: `github` — this story is not linked.

# Story intake

- Folder: `.squad/stories/identity-audit-logging/identity-audit-logging/intake.md`

---

## Feature

- **Feature name (display):** Identity & Access / Administration
- **Feature slug (folder under `plans/`):** `identity-audit-logging`

## Title

```text
Story 84 — Explicit Audit Logging: Auth Events & Permission Diffs
```

## Description

```text
docs/architecture/05-auth-and-security.md states that "services
explicitly record permission changes, exports, bulk operations,
login/logout, and failed authentication" alongside the global mutating-
request interceptor. Verified by code inspection that this is currently
unmet: the global AuditInterceptor only fires on success and can never
attribute an actor to a @Public() route (login/refresh/logout), and a
repo-wide grep found zero explicit auditLog.create calls anywhere in the
codebase. This story adds the missing explicit writes directly inside
IdentityService (the interceptor's own doc comment already names this as
the intended pattern): failed login, successful login, logout,
setRolePermissions/updateRole/updateUserAssignment (each with a real
before/after diff), and resetPassword. No schema change - the AuditLog
model and its read-side endpoint already support everything this story
writes.
```

## Acceptance criteria

```text
- [ ] A failed login (unknown/inactive user, or wrong password) writes
      an auth.login_failed AuditLog row with actorId: null.
- [ ] A successful login writes auth.login with the real actorId.
- [ ] A real logout writes auth.logout with the real actorId; a no-op
      logout writes nothing.
- [ ] setRolePermissions/updateRole/updateUserAssignment each write
      their own action with a real before/after diff.
- [ ] resetPassword writes user.password_reset.
- [ ] Audit-log writes never throw/propagate a failure into the request
      they're observing.
- [ ] No schema change; no change to AuditLogsService/
      AuditLogsController/AuditInterceptor.
- [ ] refresh() remains unchanged/uninstrumented (deliberately out of
      scope).
- [ ] Backend unit and e2e tests cover the new behavior.
- [ ] Typecheck, lint, build, and the relevant test suites pass.
```

## Dependencies

- Story 02 — AuditLog model, AuditInterceptor (foundation)
- Story 37 — audit-log-read-endpoint (GET /audit-logs, read side)
- Stories 46/47/48 — the IdentityService methods this story instruments

All prerequisites are complete; the story is fully unblocked.

## Out of scope

- refresh() token rotation (not named in the architecture doc's list).
- Exports/bulk operations (no such feature exists yet to instrument).
- Impersonation data (no impersonation feature exists in this codebase).
- Any schema change or change to the read-side audit-log endpoint.
