# Story 41 — Agent Workspace: Session Refresh & Real Sign-Out

## Prerequisites

- `project-foundation` Story 02: JWT access/refresh issuance, `IdentityController`/`IdentityService`, the non-httpOnly access-token cookie + httpOnly `SameSite=Strict` refresh-token cookie split. Already implemented; not modified.
- `agent-workspace-ticket-operations-mvp` Story 23: `CORS_ORIGINS`/`app.enableCors({ credentials: true })`, added specifically "needed for the refresh-token cookie" (that story's own plan, Design item 6) but never actually consumed by any refresh call until now.
- `POST /auth/refresh` and `POST /auth/logout` — implemented and unit-tested (`identity.service.spec.ts`: rotation, unknown/expired/already-revoked-token rejection, idempotent revoke) since Story 02. Never previously consumed by any frontend.

---

## Story Goal

Make an agent's session actually last as long as the backend already intends it to, and make "Sign out" actually end the session server-side — using only the two auth endpoints that have existed, unused, since Story 02.

**The problem, verified against the running code:** the access-token cookie the login page writes has `max-age=900` (15 minutes — matches `JWT_ACCESS_TTL` default `"15m"`, `env.validation.ts`). Nothing in `apps/web` ever calls `POST /auth/refresh`. So today, exactly 15 minutes after logging in, every subsequent request made by `apiFetch` starts failing with a real `401` — not "eventually," but reliably, on a schedule, for every single agent — and each of those screens renders its own generic "couldn't load"/"action failed" message with no indication that simply signing in again would fix it. Separately, `WorkspaceNav`'s "Sign out" button only runs `clearAccessToken()` (deletes the local, non-httpOnly cookie) and redirects to `/login` — it never calls `POST /auth/logout`, so the *server-side* refresh token is never revoked. Per `docs/architecture/05-auth-and-security.md`'s own "Authentication" section, a rotating refresh token was always the intended design; this story is the first to wire it up.

---

## Context — Read These Files First

1. `apps/web/src/lib/api.ts` — the one shared `apiFetch` wrapper every existing typed API call in the app goes through (`ACCESS_TOKEN_COOKIE`, `getAccessToken`/`clearAccessToken`, `ApiError`). This story extends this file; it does not replace it or add a second request path.
2. `apps/web/src/components/workspace/workspace-nav.tsx` — the header rendered by `(agent)/layout.tsx` above every workspace screen; its `handleSignOut` is the only sign-out entry point in the app.
3. `apps/web/src/app/[locale]/(auth)/login/page.tsx` — the only other place that currently writes the access-token cookie (inline `document.cookie = ...`), and the only existing precedent for a raw (non-`apiFetch`) `fetch(..., { credentials: "include" })` call — the exact pattern the new refresh/logout calls mirror, confirmed this planning pass: `credentials: "include"` is already required and already working end-to-end (`apps/api/src/main.ts`'s `app.enableCors({ origin: corsOrigins, credentials: true })`, `CORS_ORIGINS="http://localhost:3000"` in `apps/api/.env`).
4. `apps/api/src/modules/identity/identity.controller.ts` and `identity.service.ts` — confirmed this planning pass: `POST /auth/refresh` reads the `refreshToken` httpOnly cookie (`path: /api/v1/auth`) from the request, rotates it (old row revoked, new row + new `Set-Cookie` issued), returns `{ accessToken }`; a missing/unknown/expired/already-revoked presented token is rejected with `401`. `POST /auth/logout` revokes the presented refresh token (silently no-ops if already gone) and clears the cookie; returns `204`. Both are `@Public()` (no access-token/Bearer header required — they authenticate via the refresh cookie alone).
5. `apps/api/src/common/auth/jwt.strategy.ts` / `auth.guard.ts` — confirms every other route's global `AuthGuard` rejects an expired/invalid access token with a plain Passport-default `401`, the exact, reliable signal this story reacts to. `403` (a real permission gate, e.g. `PermissionsGuard`) is a completely different case and must **not** trigger a refresh attempt.
6. `apps/api/src/common/audit/audit.interceptor.ts` — every `POST`/`PATCH`/`PUT`/`DELETE` request (which includes the new `/auth/refresh`/`/auth/logout` calls this story adds) is already automatically written to `AuditLog` with no extra code needed — so once this story ships, real refresh/logout events become visible for free in Story 40's Audit Log Viewer.
7. `docs/architecture/05-auth-and-security.md` — "Issue a JWT access token with an approximately 15-minute lifetime and a rotating refresh token in an `httpOnly`, `Secure`, `SameSite=Strict` cookie" — confirms a working refresh flow was always the intended end state, not a new architectural decision this story is inventing.

---

## Design (resolved during this planning pass)

1. **`apiFetch` gets a retry-once-on-401 wrapped around its existing single `fetch` call, not a second request path.** On a `401` response (and only a `401` — a `403` is thrown immediately, unchanged), `apiFetch` calls the new `refreshAccessToken()` helper; on success, it retries the original request exactly once with the freshly-set access token and returns that response. On a *second* `401` (or if `refreshAccessToken()` itself fails), it clears the access-token cookie (`clearAccessToken()`, already exists) and throws the real `ApiError(401, ...)` exactly as it does today — every existing consumer's `isError`/`mutation.isError` rendering is unchanged, because the thrown shape is unchanged.
2. **`refreshAccessToken()` and `logout()` are raw `fetch(..., { credentials: "include" })` calls, not routed through `apiFetch`.** `apiFetch` attaches a Bearer header from the access-token cookie and is meant for `@RequirePermissions`-gated routes; `/auth/refresh`/`/auth/logout` are `@Public()` and authenticate via the httpOnly refresh cookie alone. Routing them through `apiFetch` would (a) send a pointless/stale Authorization header and (b) — critically — if `refreshAccessToken()` itself ever got a `401` and were itself wrapped by `apiFetch`'s own retry logic, it would recursively try to refresh again. Using a direct `fetch()` (mirroring the login page's own existing, working pattern) makes that recursion structurally impossible, not just avoided by convention.
3. **A module-level in-flight-refresh guard de-duplicates concurrent 401s.** Every existing list screen fires several `useQuery`s in parallel (e.g. `TicketListView`'s tickets/customers/users queries). If the access token has just expired, several `apiFetch` calls can 401 within the same tick. Since `/auth/refresh` **rotates and revokes** the presented refresh token (Context item 4), two independent, concurrent refresh calls would race: the second one presents a token the first one just revoked and fails a session that was actually fine. `api.ts` therefore keeps one module-level `Promise<string> | null` — the first 401 starts the refresh and stores its promise; every other concurrent 401 awaits that same promise instead of starting its own; the variable is cleared when it settles (success or failure) so the *next* independent expiry starts a fresh refresh.
4. **`setAccessToken(token)` is factored out of the login page into `api.ts`, alongside the existing `getAccessToken`/`clearAccessToken`.** Today the login page is the only place that writes the cookie, inlined as a raw `document.cookie = ...` string. This story's refresh success path needs to write that same cookie a second time; duplicating the cookie-string construction a second time would violate "do not duplicate existing auth utilities" (the login page's one line becomes `setAccessToken(accessToken)` — same cookie name/path/max-age/samesite, zero behavior change, confirmed by keeping its existing test-free status: the login page has no spec today and none is added, since its externally-observed behavior is unchanged).
5. **Sign-out becomes: best-effort real logout, then always-effective local cleanup.** `WorkspaceNav.handleSignOut` becomes `async`, awaits the new `logout()` call, then unconditionally runs the existing `clearAccessToken()` + redirect — wrapped so a network failure on the logout call (offline, API down) never blocks the user from actually leaving; the user's own intent to sign out is never gated on a round-trip succeeding, matching this codebase's own "never assume, but never block a leave-action" spirit (`clearAccessToken` already behaves this way: it always succeeds locally regardless of server state).
6. **No terminal-401 global redirect is introduced.** If refresh itself ultimately fails (refresh token expired/revoked — the agent has been away longer than `JWT_REFRESH_TTL_DAYS`, or logged out elsewhere), `apiFetch` clears the cookie and throws `ApiError(401)` exactly as an unrefreshed 401 does today; the *next* full navigation naturally redirects to `/login` via `(agent)/layout.tsx`'s existing `fetchCurrentUser()` guard (Context — no change needed there). A user who stays on the same client-rendered page after their refresh token has truly died sees today's existing generic error state, not an instant bounce to `/login` — no global "redirect on terminal 401" listener exists anywhere in this codebase today, and inventing one is a separate, larger cross-cutting concern this story does not take on (see Non-Goals).
7. **Zero new i18n strings.** No new user-facing copy is introduced anywhere: the sign-out button's label is unchanged, a silent-refresh success is invisible by design (that's the point), and every failure path (refresh fails, logout call fails) resolves into either the existing generic error messages already wired into every screen or no visible message at all (a failed best-effort logout still ends in the same "signed out" local state the user asked for).

---

## Implementation Tasks

### 1 — `apps/web/src/lib/api.ts` (modify)

- Add `setAccessToken(token: string): void` — writes `ACCESS_TOKEN_COOKIE` with the same `path=/; max-age=900; samesite=lax` shape the login page currently inlines.
- Add `refreshAccessToken(): Promise<string>` — `fetch(`${getApiBaseUrl()}/auth/refresh`, { method: "POST", credentials: "include" })`; on success, parses `{ accessToken }`, calls `setAccessToken(accessToken)`, and returns it; on a non-2xx response, throws (no special type needed — the caller only needs success/failure).
- Add `logout(): Promise<void>` — `fetch(`${getApiBaseUrl()}/auth/logout`, { method: "POST", credentials: "include" })`; swallows any error (network failure or non-2xx) rather than throwing — this call is always best-effort from the caller's point of view.
- Add a module-level `let inFlightRefresh: Promise<string> | null = null;` and a small `refreshAccessTokenOnce()` helper: returns `inFlightRefresh` if already set, otherwise starts `refreshAccessToken()`, stores it, and clears the module variable in a `.finally()` once it settles.
- Restructure `apiFetch<T>`'s body: extract the existing single `fetch` + response-to-`ApiError` logic into an inner `attempt()` closure; call it once; if the result is a `401`, call `refreshAccessTokenOnce()` — on success, call `attempt()` a second time and return/throw based on *that* result; on refresh failure (or a second 401), call `clearAccessToken()` and throw the original `ApiError(401, ...)`. A `403` (or any other status) is thrown immediately, unchanged from today.

### 2 — `apps/web/src/components/workspace/workspace-nav.tsx` (modify)

- `handleSignOut` becomes `async`; calls the new `logout()` from `@/lib/api` (already imports `clearAccessToken` from there), then unconditionally runs the existing `clearAccessToken()` + `router.push(...)`.

### 3 — `apps/web/src/app/[locale]/(auth)/login/page.tsx` (modify — one line)

- Replace the inline `document.cookie = `${ACCESS_TOKEN_COOKIE}=${accessToken}; path=/; max-age=900; samesite=lax`;` with `setAccessToken(accessToken)`, imported from `@/lib/api` alongside the existing `ACCESS_TOKEN_COOKIE`/`getApiBaseUrl` import (drop the now-unused `ACCESS_TOKEN_COOKIE` import if nothing else on the page needs it). No behavior change — same cookie, same shape.

### 4 — Tests

- `apps/web/src/lib/api.spec.ts` (new — first test file for this module): mock global `fetch`.
  - `apiFetch` attaches `Authorization: Bearer <token>` from the access-token cookie.
  - A `403` response throws `ApiError(403, ...)` immediately, with no second `fetch` call attempted (proves refresh is never triggered for a permission failure).
  - A `401` followed by a successful `/auth/refresh` retries the original request once and resolves with the retried response's data; `setAccessToken` is observably called (or the new cookie value is asserted) with the refreshed token.
  - A `401` where `/auth/refresh` itself fails: `clearAccessToken` is called and the original `ApiError(401, ...)` is thrown; no infinite retry loop occurs.
  - Two concurrent `apiFetch` calls that both 401 at once result in exactly **one** call to `/auth/refresh` (asserted via mock call count) — both original calls still resolve correctly afterward.
  - `logout()` calls `POST /auth/logout` with `credentials: "include"` and does not throw when the underlying `fetch` rejects/returns non-2xx.
- `apps/web/src/components/workspace/workspace-nav.spec.tsx` (new — first test file for this component): mirrors this codebase's existing `next/navigation`/`next-intl` mocking conventions (e.g. `ticket-list-view.spec.tsx`).
  - Renders the signed-in-as name and sign-out button.
  - Clicking sign-out calls the logout function, then clears the access token and navigates to `/${locale}/login`.
  - Clicking sign-out still clears the token and navigates to `/${locale}/login` even when the logout call rejects (best-effort — the user is never stuck).

---

## Edge Cases & Failure Modes

- **Access token expires mid-session, refresh token still valid**: the next `apiFetch` call transparently refreshes and retries — the user sees no error, no re-login prompt, and (for a query) no visible loading flicker beyond the one extra round-trip.
- **Both tokens expired/revoked (agent away longer than `JWT_REFRESH_TTL_DAYS`, or already logged out elsewhere)**: `apiFetch` throws the same `ApiError(401, ...)` every screen already renders as its existing generic error state today; the next full navigation redirects to `/login` via the existing layout guard.
- **Several queries 401 at the same moment**: exactly one `/auth/refresh` call is made (module-level dedup, Design item 3); every caller retries against the one refreshed token.
- **Logout is clicked while offline / API unreachable**: the local session still ends (cookie cleared, redirected to `/login`) — the server-side refresh token may remain valid until it naturally expires, which is the same outcome as today's behavior (no regression) and is an accepted trade-off for never blocking a user's explicit sign-out on a network call.
- **A 403 is never treated as a refresh trigger**: every existing "you don't have permission" inline message (ticket detail, customer detail, SLA policy row, business-hours row, etc.) is completely unaffected.

---

## Test Plan

1. **Unit/component**: as listed in Implementation Task 4 — first-ever coverage for `api.ts` and `workspace-nav.tsx`.
2. **Regression**: full existing `apps/web` suite remains green — this story modifies exactly three existing files (`api.ts`, `workspace-nav.tsx`, `login/page.tsx`) and every existing consumer of `apiFetch`/`ApiError` is exercised by the existing suite already. `apps/api`/`apps/worker` unaffected — run for confirmation only.

---

## Migration / Rollback

None. No Prisma schema or migration change, no new/changed backend endpoint. Rollback is a plain code revert of the three modified files plus the two new spec files.

---

## Verification Steps

1. `pnpm --filter @crm/web typecheck`, `lint`, `build`; workspace-wide `pnpm typecheck`/`lint`/`build`.
2. `pnpm --filter @crm/web test`; `pnpm --filter @crm/api test`; `pnpm --filter @crm/worker test` (regression only).
3. Live infra (if available): log in for a real access token; manually clear/corrupt only the access-token cookie (leaving the httpOnly refresh cookie intact) and trigger any authenticated screen action — confirm it silently succeeds via a real `POST /auth/refresh` rather than erroring. Then sign out and confirm a subsequent real `POST /auth/refresh` (presenting the now-revoked refresh cookie) is rejected with `401`. Confirm both the refresh and logout calls appear as new rows in the real Audit Log Viewer (Story 40).
4. `pnpm --filter @crm/api test:e2e` — regression only (no backend file is touched).
5. Hygiene: `git status`; confirm `apps/api/**`, `schema.prisma`, migrations, every `messages/*.json`, and every existing `apps/web` file **other than** `api.ts`/`workspace-nav.tsx`/`login/page.tsx` have empty diffs.
6. Browser/DOM verification: not claimed unless an actual browser automation capability is available.

## Done Criteria

- [ ] An access token expiring mid-session no longer hard-fails a request — the real `POST /auth/refresh` is used to obtain a new one and the original request is retried transparently.
- [ ] Concurrent 401s across simultaneously in-flight requests result in exactly one real `POST /auth/refresh` call.
- [ ] "Sign out" calls the real `POST /auth/logout`, revoking the refresh token server-side, before clearing local state and redirecting.
- [ ] Sign-out always completes locally (cookie cleared, redirected) even if the logout network call fails.
- [ ] A `403` never triggers a refresh attempt; every existing forbidden-message UI is unaffected.
- [ ] No new backend endpoint, DTO field, permission, Prisma model, migration, or business rule.
- [ ] No i18n changes (none required).
- [ ] No existing `apps/web` file is modified other than `api.ts`, `workspace-nav.tsx`, and `login/page.tsx` (the last with a single, behavior-preserving line change).
- [ ] Unit/component tests exist and pass for both modified files' new behavior; existing tests remain green.
- [ ] Typecheck/lint/build clean, workspace-wide.
- [ ] `git status` shows no unrelated changes after implementation.

---

## Non-Goals (explicit)

- A global "redirect to `/login` the instant a terminal 401 is hit" listener/mechanism — no such cross-cutting pattern exists anywhere in this codebase today; the existing per-navigation layout guard already recovers this case on the next page load (Design item 6).
- Any change to `TicketDetailView`, `CreateTicketView`, `tickets-api.ts`, or any other screen (Story 41 is `api.ts`/`workspace-nav.tsx`/`login/page.tsx` only — Stories 42+ own ticket-detail/ticket-creation extensions).
- A persistent cross-screen navigation menu (a separate, previously and repeatedly deferred decision — see every prior Agent Workspace story's plan — not reopened here; this story's `workspace-nav.tsx` change is limited to the sign-out handler).
- Any change to `POST /auth/login`, `GET /auth/me`, token TTLs, cookie flags, or any other backend auth behavior.
- A "remember me" / long-lived-session feature, multi-tab session sync, or a background/proactive (pre-expiry) refresh timer — this story is reactive-on-401 only, matching the minimal shape needed to fix the verified gap.

---

**STOP HERE. Report to the user and wait for confirmation before implementing.**
