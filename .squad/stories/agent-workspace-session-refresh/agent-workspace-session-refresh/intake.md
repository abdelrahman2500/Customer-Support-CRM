> **Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

Fill this template for each story you want planned. Keep it copy-paste-friendly: the planner reads **this file and the files in `attachments/`**, nothing else.

- Folder: `.squad/stories/agent-workspace-session-refresh/agent-workspace-session-refresh/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- **Do not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

---

## Feature

- **Feature name (display):** Agent Workspace — Session Refresh & Real Sign-Out

- **Feature slug (folder under `plans/`):** `agent-workspace-session-refresh`

## Tracker (metadata only)

- **Tracker type:** `github`

- **Work item id:** `` _(used in filenames and plan tables; fill manually if empty)_

- **Work item type:** ``

- **Status:** ``

- **Assignee:** ``

- **Labels:** ``

External tracker links are **not** followed by the planner. Keep the id for naming and traceability only.

---

## Title

```text
Agent Workspace — Session Refresh & Real Sign-Out
```

---

## Description

```text
A Story 38+ recon (run against the repository after Stories 38/39/40 landed) enumerated every backend endpoint and cross-checked it against every frontend consumer. It found that `POST /auth/refresh` and `POST /auth/logout` — implemented and unit-tested since Story 02, including refresh-token rotation and server-side revocation — are the only two backend endpoints in the entire API with zero frontend consumer.

Verified impact: the access-token cookie the login page writes has `max-age=900` (15 minutes, matching `JWT_ACCESS_TTL`'s default). With no refresh call anywhere in `apps/web`, every agent's session hard-fails exactly 15 minutes after login — every subsequent request 401s and renders as a generic "couldn't load" error, with no recovery except signing in again. Separately, `WorkspaceNav`'s "Sign out" only clears the local access-token cookie; it never calls the real `POST /auth/logout`, so the server-side refresh token is never revoked.

This story wires up both endpoints, entirely inside the frontend: a retry-once-on-401 refresh inside the one shared `apiFetch` wrapper every screen already goes through, and a real server-side logout call before the existing local sign-out cleanup. No new backend endpoint, DTO, or contract — both endpoints already exist, are already unit-tested, and the CORS/cookie plumbing they need (`credentials: true`, `CORS_ORIGINS`) was already added in Story 23 specifically anticipating this.
```

---

## Acceptance criteria

```text
- An access token that has expired mid-session no longer hard-fails the next request: `apiFetch` transparently calls the real `POST /auth/refresh` and retries the original request once.
- Multiple requests that 401 at the same moment (e.g. a list screen's several parallel queries) result in exactly one real `POST /auth/refresh` call, not one per request.
- A `403` (a real permission rejection) never triggers a refresh attempt and is thrown exactly as it is today — no existing "forbidden" message anywhere in the app changes behavior.
- "Sign out" calls the real `POST /auth/logout` (revoking the refresh token server-side) before clearing the local access-token cookie and redirecting to `/login`.
- Sign-out still completes locally (token cleared, redirected) even if the logout network call fails — the user's intent to leave is never blocked on a round-trip.
- If refresh itself ultimately fails (refresh token also expired/revoked), the existing behavior is preserved: the failing request's `ApiError(401)` is thrown and rendered by whatever screen made it, and the next full navigation redirects to `/login` via the existing `(agent)/layout.tsx` guard — no new global redirect mechanism is introduced.
- No new backend endpoint, DTO field, permission, Prisma model, migration, or business rule.
- No file outside `apps/web/src/lib/api.ts`, `apps/web/src/components/workspace/workspace-nav.tsx`, and `apps/web/src/app/[locale]/(auth)/login/page.tsx` (the last a single behavior-preserving line) is modified.
- Component/unit tests cover: successful silent refresh-and-retry, refresh failure, concurrent-401 deduplication, 403 never triggering refresh, and sign-out's real-logout-then-always-cleanup behavior.
- Typecheck, lint, and build remain clean; existing backend/frontend/worker test suites remain unaffected.
```

---

## Attachments

| File (relative to this folder) | What it is      |
| ------------------------------ | --------------- |
| None                           | No attachments. |

---

## Dependencies

- **Blocked by / related ids:** `project-foundation` Story 02 (`IdentityController`/`IdentityService`, JWT access/refresh issuance — never previously consumed for refresh/logout by any frontend); `agent-workspace-ticket-operations-mvp` Story 23 (`CORS_ORIGINS`/`credentials: true`, added specifically for this eventual need).

- **Depends on code areas or other stories:** none inside `apps/api` — `identity.controller.ts`/`identity.service.ts` are a read-only dependency, not modified. Touches exactly three existing `apps/web` files (see Acceptance criteria).

## Extra notes (optional)

- This was the top candidate out of four Category-A options surfaced by the Story 38+ recon (session refresh/logout; ticket-detail subject+department editing; ticket-creation contact/department/assignee pickers; a persistent nav menu). It was selected because: it is a genuine, verified, user-impacting gap (not just "an endpoint exists"); it has zero file overlap with the ticket-detail/ticket-creation candidates (which both extend `tickets-api.ts` and therefore should not be parallelized with each other); and — unlike the nav-menu candidate — it does not reopen any previously, repeatedly deferred scope decision.
- **Not a zero-overlap "new file" story** like Stories 30–40: this is the first Agent Workspace story that must extend existing shared files (`api.ts`, `workspace-nav.tsx`) rather than add an entirely new route/component surface, because the gap it fixes lives in the one shared request pipeline itself.
- A persistent navigation menu remains explicitly out of scope here, unchanged from every prior story's plan — this story's `workspace-nav.tsx` change touches only the sign-out handler.

## Technical hints (optional)

- `POST /auth/refresh` and `POST /auth/logout` are both `@Public()` (authenticate via the httpOnly `refreshToken` cookie alone, not a Bearer access token) — confirmed in `identity.controller.ts` this planning pass.
- The refresh token is **rotated** on every use (old row revoked, new row issued) and reuse of an already-revoked token fails closed (`identity.service.spec.ts` already covers this) — this is why concurrent 401s must be de-duplicated to a single in-flight refresh, not fired once per failing request.
- `AuthGuard` (global, Passport `jwt` strategy, `ignoreExpiration: false`) rejects an expired/invalid access token with a plain `401` — the exact signal to react to; `PermissionsGuard`'s `403` is a separate, unrelated case.
- Every mutating request (including the new refresh/logout calls) is already automatically written to `AuditLog` by the global `AuditInterceptor` — no extra code needed for these to show up in Story 40's Audit Log Viewer.

## Out of scope

- Ticket Detail subject/department editing, Ticket Creation contact/department/assignee pickers, and a persistent workspace navigation menu — three separate candidates from the same recon, not part of this story.
- Any change to `POST /auth/login`, `GET /auth/me`, token TTLs, cookie flags, or any other backend auth behavior.
- A global "redirect to `/login` on terminal 401" mechanism, proactive/background token refresh, "remember me", or multi-tab session sync.
- Knowledge Base, AI, Customer Portal, Reporting, Integrations, generalized `AutomationRule` engine.
