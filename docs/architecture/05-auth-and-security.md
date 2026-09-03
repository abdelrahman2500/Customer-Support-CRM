# Authentication, Authorization & Security

## Authentication

- Issue a JWT access token with an approximately 15-minute lifetime and a rotating refresh token in an `httpOnly`, `Secure`, `SameSite=Strict` cookie through `IdentityModule` and Passport JWT strategy.
- Agents/admins authenticate against `identity.users`. Portal customers use a separate email/password or magic-link flow in `PortalModule`. Tokens carry `audience: agent` or `audience: customer` so audiences cannot cross endpoints.
- SSO (OIDC/SAML) is deferred; Passport allows a later strategy without changing the auth pipeline.

## Authorization

- RBAC is primary: `Role` to `Permission` is many-to-many in the `identity` schema, and users can have different roles by branch/department.
- CASL handles fine-grained checks such as assignment and department visibility.
- A global `AuthGuard` and `PermissionsGuard` protect every controller method using decorators such as `@RequirePermissions('ticket:reassign')`. Frontend visibility is never the only protection.

## Audit logging

- `admin.audit_logs` is append-only, with application DB roles denied `UPDATE` and `DELETE`. It records actor and impersonation data, action, entity type/id, before/after JSON diff, branch/department context, IP, and timestamp.
- A global NestJS interceptor records mutating requests; services explicitly record permission changes, exports, bulk operations, login/logout, and failed authentication.
- Reads are branch-scoped, but no application role can edit or delete audit records.

## Security boundaries

- In real environments `apps/api` is behind a reverse proxy/WAF. Only auth, portal, and webhook routes are internet-facing.
- Secrets are environment variables validated at boot with `@nestjs/config` and `zod`; missing or malformed secrets fail startup.
- Every controller input is a `class-validator` DTO. NestJS Throttler protects auth, portal, and inbound webhook endpoints.
- Account lockout: 5 consecutive failed login attempts locks the account for 15 minutes (or until an admin manually unlocks it via `POST identity/users/:id/unlock`) — per-account, independent of source IP, complementing the IP-based Throttler above. A locked account's login attempt returns the same generic 401 as any other failure.
- The runtime DB role cannot alter schema; a separate migration role is used only by CI/deploy.
- Provider signatures verify inbound email/WhatsApp/SMS/ERP webhooks before processing; requests are rate-limited and logged.
