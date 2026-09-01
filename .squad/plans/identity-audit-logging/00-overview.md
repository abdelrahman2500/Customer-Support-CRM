# identity-audit-logging — plan overview

Entry point for the **identity-audit-logging** feature. Stories execute
in order by their `NN` prefix.

## Stories

| NN | File | Title | Tracker id | Depends on |
|----|------|-------|------------|------------|
| 84 | [84-story-identity-audit-logging.md](./84-story-identity-audit-logging.md) | Explicit Audit Logging — Auth Events & Permission Diffs | — | Story 02 (`AuditLog` model, `AuditInterceptor`), Story 37 (`AuditLogsService`/`Controller` read side), Stories 46/47/48 (`IdentityService` methods this story instruments) |

## Dependency notes

- Closes a real, currently-unmet architecture-doc commitment:
  `docs/architecture/05-auth-and-security.md` states plainly *"A global
  NestJS interceptor records mutating requests; services explicitly
  record permission changes, exports, bulk operations, login/logout, and
  failed authentication."* Verified by direct code inspection: the
  global `AuditInterceptor` only fires on success (`tap()` on the
  success path of the observable) and can never attribute an actor to a
  `@Public()` route (`request.user` is never populated there) — so
  today, a failed login, a successful login/logout, and every
  permission/role change are either unlogged or logged with `actorId:
  null` and no `diff`. A repo-wide grep confirms zero explicit
  `auditLog.create` calls exist anywhere outside the generic
  interceptor.
- The read side (`AuditLogsService`/`AuditLogsController`, Story 37) and
  the `AuditLog.diff Json?`/`actorId String?` columns already fully
  support what this story writes — no schema change, no read-side
  change.
- "Exports" and "bulk operations" (also named in the doc) are correctly
  out of scope: no export or bulk-operation feature exists anywhere in
  this codebase yet to instrument — the interceptor's own doc comment
  already defers that to "feature modules that need a real before/after
  diff," i.e. whichever future story adds that functionality.
- No dependency on the unresolved external-provider decision — entirely
  internal to `IdentityModule`, using the already-existing `AuditLog`
  Prisma model.
