# RM-22 — API-Key Authentication for Machine-to-Machine Consumers

**Priority:** P1 · **Complexity:** Small-Medium · **Blocked:** No · **Phase:** 6 (Integration Platform)

## Goal

Add an API-key authentication strategy alongside the existing JWT strategy,
for a defined, explicitly-allowlisted set of machine-callable routes.

## Why it exists

`docs/architecture/09-integrations.md`: "Machine-to-machine consumers
initially use API keys" — described, never implemented. Only JWT exists in
code today (confirmed: no `ApiKeyGuard`/API-key strategy anywhere in
`apps/api/src/common/auth`).

## Dependencies

None. Additive alongside the existing `AuthGuard`/`AudienceGuard`/
`PermissionsGuard` global-guard stack — does not touch or weaken any of
them for existing JWT-authenticated routes.

## Backend work

- `ApiKey` model: `id`, `branchId`, `hashedKey` (never store the raw key —
  same hashing discipline as `RefreshToken`'s existing SHA-256 pattern),
  `scopes` (string array, mirrors permission-key naming), `label`,
  `revokedAt` (nullable), `createdByUserId`, `createdAt`, `lastUsedAt`.
- A Passport strategy checked alongside (not instead of) the existing JWT
  guard — a route explicitly opted into API-key auth via a new
  `@AllowApiKey()` decorator, checked in the same guard-composition spot
  `AudienceGuard` already occupies.
- Admin CRUD for issuing/revoking keys: `POST /admin/api-keys` (returns the
  raw key exactly once, never retrievable again — same one-time-reveal
  convention many systems use), `GET /admin/api-keys` (lists metadata only,
  never the key itself), `DELETE /admin/api-keys/:id` (revoke).
- A scope-check on every `@AllowApiKey()` route, analogous to
  `@RequirePermissions`.

## Frontend work

- Admin UI for issuing/listing/revoking API keys (one-time-reveal dialog
  on creation, mirroring how this codebase already handles a comparable
  one-time-secret UX if one exists, or a clearly-labeled new pattern if
  not).

## Worker/realtime work

None.

## Schema/migration work

New `ApiKey` model, one migration.

## Tests

- `api-key.strategy.spec.ts` — valid key accepted, revoked key rejected,
  scope-mismatch rejected.
- e2e: a request bearing a valid key can call an explicitly-allowlisted
  route; a revoked or scope-mismatched key is rejected; existing
  JWT-authenticated flows are entirely unaffected (regression-test the
  existing identity/portal e2e suites still pass unchanged).

## Acceptance criteria

- A request bearing a valid API key can call an explicitly-allowlisted
  route.
- A revoked or scope-mismatched key is rejected.
- Every existing JWT-authenticated route and flow is completely unaffected.

## Definition of Done

- All acceptance criteria verified.
- `pnpm --filter @crm/api test`, `test:e2e`, `pnpm --filter @crm/web test`,
  `pnpm typecheck`, `pnpm lint`, `pnpm build` pass.
- One dedicated commit, pushed.
