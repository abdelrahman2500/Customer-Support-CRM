# Story 132 — Customer Data Anonymization / Right-to-Erasure

## Prerequisites

- **Story 06 completed** — [`../customer-management/06-story-customer-and-contact-foundation.md`](../customer-management/06-story-customer-and-contact-foundation.md). Shipped `Customer`/`Contact` (`customers` schema), `CustomersService`, `CustomersController`/`ContactsController`, and the branch-scoping helper `requireCustomerInScope`. **This story extends that service — it does not create a second customer-mutation path.**
- **Story 52 completed** — portal contact authentication: `Contact.passwordHash` (nullable, no self-registration), `ContactRefreshToken`, `PortalService.login/refresh/revoke/getAuthenticatedContact`.
- **Story 100 completed** — customer deactivation gating portal access: `PortalService.login` (`apps/api/src/modules/portal/portal.service.ts:55`) and `PortalService.refresh` (`:90`) both reject when `!contact.customer.isActive`, plus `revokeContactPortalAccess` (`customers.service.ts:351–369`) and its UI affordance. **This story reuses that enforcement; it must not add a parallel mechanism.**
- **Story 03 / identity completed** — `PERMISSION_CATALOG` and `ROLE_GRANTS` in `apps/api/prisma/seed.ts`, the `@RequirePermissions()` decorator, and the global `PermissionsGuard`.
- **Story 114 / P1-2 completed** — `apps/e2e` Playwright harness, `apps/e2e/tests/support/api-client.ts` (`loginAsAdmin`, `createPortalContactAsAdmin`, `createPortalContactWithTicketAsAdmin`).

**Baseline commit for every line reference below:** `cdf9063`. Re-verify any line number that has drifted before relying on it.

---

## Story Goal

Give a branch admin one irreversible, auditable action that removes a customer's **structured identifying data** and their portal access, while leaving ticket, SLA and reporting history intact and correct.

1. **Anonymize in place, never delete.** Overwrite/clear the identifying fields on the `Customer` and every one of its `Contact` rows, cut portal access, and stamp `anonymizedAt` on both. No row is removed.
2. **A dedicated permission.** `customer:anonymize`, granted to `SuperAdmin` only — never folded into the `customer:update` that agents already hold for routine edits.
3. **One transaction.** Either every field is anonymized and every refresh token revoked, or nothing changes.
4. **Honest scope.** Free-text message/note/CSAT bodies, stored file contents, and the immutable audit log are **retained**, and the story says so rather than implying total erasure.

**Not in scope** (each is an intake "Out of scope" item or a deliberate deferral):

- **Hard deletion of `Customer` or `Contact`, in any form.** The database forbids it: `ticketing.tickets.customer_id` is `RESTRICT NOT NULL`, so any customer with a ticket cannot be deleted; `ticket_csat_responses.submitted_by_contact_id` is the same at contact level. Forcing it would also cascade away `customer_notes`, `customer_attachments`, `notification_logs`, `portal_notification_preferences` and whole `ai.chat_sessions` histories.
- **Any change to a foreign key, referential action, or cascade.** Not to enable deletion, not for convenience.
- **Scrubbing free text** — `ChannelMessage.body`, `ChatMessage.body`, `CustomerNote.body`, `TicketCsatResponse.comment`.
- **Purging S3 objects** behind `TicketAttachment`/`CustomerAttachment`.
- **Touching `admin.audit_logs`.** It is immutable by design and must stay so.
- **Client-side permission gating.** The web app has no caller-permission signal (see Task 8); introducing one is a new authorization model.
- Self-service erasure from `apps/portal`, bulk anonymization, data export, un-anonymize/restore, scheduled retention expiry.

---

## Context — Read These Files First

1. **`apps/api/prisma/schema.prisma`** — `model Customer` and `model Contact` (`customers` schema). Note what is already there: `Customer.isActive Boolean @default(true)`; `Contact.email String?`, `Contact.phone String?`, `Contact.passwordHash String?`, `Contact.preferredLocale String?`, and `@@unique([customerId, email])`. Neither model has any `deletedAt`/`isDeleted`/`anonymizedAt` field today.
2. **`apps/api/src/modules/customers/customers.service.ts`** — especially `requireCustomerInScope` (branch scoping every route uses) and **`revokeContactPortalAccess` at lines 351–369**, the exact transactional shape this story mirrors:
   ```ts
   await this.prisma.$transaction([
     this.prisma.contact.update({ where: { id: contactId }, data: { passwordHash: null } }),
     this.prisma.contactRefreshToken.updateMany({
       where: { contactId, revokedAt: null },
       data: { revokedAt: new Date() },
     }),
   ]);
   ```
3. **`apps/api/src/modules/portal/portal.service.ts`** — `login` (`:49–59`), `refresh` (`:~85–101`), `getAuthenticatedContact` (`:113–124`). Read all three together; the difference between them is the subject of Task 5.
4. **`apps/api/prisma/seed.ts`** — `PERMISSION_CATALOG` (the flat key list) and `ROLE_GRANTS` (`SuperAdmin: PERMISSION_CATALOG`, plus an explicit `Agent` list that already contains `customer:update`). The seed reconciles both on every run via a delete-then-recreate transaction, so adding a key here corrects existing databases too.
5. **`apps/web/src/components/customers/customer-detail-view.tsx`** — the revoke-portal-access control at **lines 191–221** (button + `ConfirmDialog` + `mutation.isError` inline alert) and the isActive `Select` at **lines 532–535**. The new action mirrors the former's shape, and must be visually distinct from the latter.
6. **`apps/web/src/hooks/use-error-message.ts`** — the shared `useErrorMessage()(error, { forbidden, generic })` convention every mutation in this codebase uses for 403-vs-other.
7. **`docs/architecture/05-auth-and-security.md:17,19`** — audit logs are append-only, application roles denied `UPDATE`/`DELETE`. Pinned by `apps/api/test/audit-log-db-grants.e2e-spec.ts:74`. This is why audit-log residue is a documented non-goal, not an oversight.

---

## Product rules (from story)

- Anonymization is **irreversible**. There is no restore path, and the UI must say so before the user confirms.
- Anonymization **implies deactivation** — `isActive` becomes `false` in the same transaction. An anonymized customer is never left able to log in.
- Anonymization is **idempotent**. A second call succeeds and changes nothing further; `anonymizedAt` records the *first* erasure and is never re-stamped.
- **History is preserved and stays attributable by id.** Ticket ids, statuses, timestamps, SLA outcomes and report inputs are untouched.
- **Retained data is disclosed, not hidden.** Free-text bodies, stored files and audit records remain; the confirmation copy and the docs must not claim otherwise.

---

## Backend Tasks

### 1 — Schema: two nullable columns

`apps/api/prisma/schema.prisma`.

On `model Customer`, alongside `isActive`:

```prisma
/// Story 132 — set once, when an admin anonymizes this customer. `null`
/// means "never anonymized", which every pre-Story-132 row correctly is.
/// Never cleared: anonymization is irreversible by design, so this is the
/// durable, queryable record that the erasure happened and when.
anonymizedAt DateTime? @map("anonymized_at")
```

On `model Contact`, the same field with the same doc-comment intent (stamped with the *same* timestamp as its parent Customer, in the same transaction).

**Constraints on this task:**
- Both columns are **nullable with no default**. No existing row's meaning changes.
- Do **not** add an index. There is no query that filters on it in this story; adding one speculatively is unjustified.
- Do **not** alter any existing field, constraint, or referential action.

### 2 — Migration

`apps/api/prisma/migrations/<YYYYMMDDHHMMSS>_add_customer_contact_anonymized_at/migration.sql`, following the established naming convention (see `20260915000000_add_notification_template_is_active`).

```sql
ALTER TABLE "customers"."customers" ADD COLUMN "anonymized_at" TIMESTAMP(3);
ALTER TABLE "customers"."contacts"  ADD COLUMN "anonymized_at" TIMESTAMP(3);
```

**Two `ADD COLUMN` statements. Zero `DROP`. Zero data rewrite.**

> **Known hazard, from Story 129 and Story 130.** `prisma migrate dev` on this repository has twice picked up unrelated pre-existing drift (a generated `search_vector` column, an `eligible_agent_pool` default) and produced a destructive migration. **Hand-write this SQL** and apply it with `prisma migrate deploy`; do not let `migrate dev` author it. If `migrate dev` has already written a file, delete it and the failed `_prisma_migrations` row before proceeding.

### 3 — Permission

`apps/api/prisma/seed.ts`:

- Add `"customer:anonymize"` to `PERMISSION_CATALOG`, positioned next to the existing `customer:*` keys.
- **Do not** add it to `ROLE_GRANTS.Agent`. `SuperAdmin` receives it automatically via `SuperAdmin: PERMISSION_CATALOG`.
- No other change to this file.

The existing delete-then-recreate reconciliation means a `pnpm prisma:seed` run grants it on already-seeded databases — no bespoke backfill.

### 4 — Service: `CustomersService.anonymizeCustomer`

`apps/api/src/modules/customers/customers.service.ts`. Add one method, next to `revokeContactPortalAccess`, whose shape it mirrors.

```ts
/** A stable, non-identifying replacement. Not a random value: two
 *  anonymized customers should be indistinguishable, and a random token
 *  would itself be a per-row identifier. */
const ANONYMIZED_CUSTOMER_NAME = "Anonymized customer";
const ANONYMIZED_CONTACT_NAME = "Anonymized contact";
```

Behaviour:

1. `await this.requireCustomerInScope(customerId)` — branch scoping and 404 come free, identically to every other route.
2. Load the customer with its contacts (ids only).
3. **Idempotency guard:** if `customer.anonymizedAt !== null`, return `{ id, anonymizedAt }` **without** re-stamping and without a second write. A repeat call is a success, not a conflict — the end state is already the desired one.
4. Otherwise, compute one `const anonymizedAt = new Date()` and run a **single `this.prisma.$transaction([...])`** containing:
   - `customer.update` → `displayName: ANONYMIZED_CUSTOMER_NAME`, `isActive: false`, `anonymizedAt`.
   - `contact.updateMany({ where: { customerId } })` → `fullName: ANONYMIZED_CONTACT_NAME`, `email: null`, `phone: null`, `preferredLocale: null`, `passwordHash: null`, `anonymizedAt`.
   - `contactRefreshToken.updateMany({ where: { contact: { customerId }, revokedAt: null }, data: { revokedAt: anonymizedAt } })`.
5. Return `{ id: customerId, anonymizedAt }`.

**Decisions this task must honour:**

- **`email` is cleared to `null`, never to a placeholder string.** `@@unique([customerId, email])` would reject a second contact receiving the same placeholder; PostgreSQL permits multiple NULLs. This is the single most likely implementation mistake in the story — Task 11 pins it with a test.
- **Refresh tokens are `updateMany`-revoked, not deleted** — same precedent as `revokeContactPortalAccess`, so the token trail survives.
- `updateMany` handles **zero contacts** (affects 0 rows, no error) and **multiple contacts** (all of them) with no branching. Do not write a loop.
- Contacts already holding `null` email/phone or a `null` `passwordHash` are simply re-set to the same value — harmless, no special case.
- Expose the new field on `CustomerSummary` (`anonymizedAt: Date | null`) so the UI can render the anonymized state.

### 5 — Portal enforcement: verify, then decide

**Verify first, change nothing speculatively.**

`getAuthenticatedContact` (`portal.service.ts:113–116`) throws `UnauthorizedException` when `!contact.passwordHash`. Since Task 4 nulls `passwordHash` for every contact, **an anonymized customer's contacts are already locked out of every portal data route immediately**, including with an unexpired access token. Task 12 asserts this rather than assuming it.

Login and refresh are separately blocked by their existing `!contact.customer.isActive` checks, because Task 4 also sets `isActive: false`.

**So this story requires no production change to `PortalService`** — and must not make one "for tidiness".

The residual inconsistency the audit found is *narrower* than it first appears: a **plain deactivation** (`PATCH /customers/:id` with `isActive: false`, without revoking access) leaves `passwordHash` intact, so `getAuthenticatedContact` still passes and an already-issued access token keeps working for up to its 15-minute TTL. That is a pre-existing Story 100 behaviour, not something Story 132 introduces. **See Open Questions — do not fix it inside this story without an explicit decision.**

### 6 — Controller

`apps/api/src/modules/customers/customers.controller.ts`:

```ts
@Post(":id/anonymize")
@RequirePermissions("customer:anonymize")
anonymize(@Param("id") id: string): Promise<{ id: string; anonymizedAt: Date }> {
  return this.customersService.anonymizeCustomer(id);
}
```

`POST`, not `DELETE` — nothing is deleted, and a `DELETE` verb here would misdescribe the operation to every reader and API consumer. No request body: the resource id is the whole input.

### 7 — No other backend change

No new module, no new guard, no audit-write of its own. The global `AuditInterceptor` already records the mutating request (actor, route, IP), and `anonymizedAt` is the durable domain record.

---

## Frontend Tasks

### 8 — API client + hook

`apps/web/src/lib/customers-api.ts` (or wherever `CustomerSummary` is declared — confirm at implementation time): add `anonymizedAt: string | null` to the summary type and an `anonymizeCustomer(id)` function posting to the new route.

`apps/web/src/hooks/use-customers.ts` (confirm the file): add `useAnonymizeCustomerMutation(customerId)`, invalidating the same customer query keys the existing update/revoke mutations invalidate.

### 9 — The customer detail action

`apps/web/src/components/customers/customer-detail-view.tsx`. Mirror the revoke-portal-access control (lines 191–221) in structure, but place it in its own clearly separated block — **not** adjacent to the active/inactive `Select` (lines 532–535), which it must not be confused with.

- `Button variant="destructive"`, disabled while `mutation.isPending`, label switching to a submitting string — this is what prevents double submission.
- Wrapped in the shared `ConfirmDialog` (`open`/`onOpenChange`/`title`/`description`/`confirmLabel`/`onConfirm`/`isPending`), exactly as the revoke control does.
- The dialog description must state **both** that the action is irreversible **and** that ticket history is retained. This is the one piece of copy a user reads before an irreversible act; it must not be vague.
- `mutation.isError` renders inline via `useErrorMessage()(error, { forbidden, generic })` — the 403 path is what a non-SuperAdmin actually sees (see Task 10).
- When `customer.anonymizedAt !== null`, render an anonymized indicator (a `Badge`, consistent with the existing active/inactive badge) and **do not render the action at all**.

### 10 — Permission visibility: follow the existing convention

**Do not add client-side permission gating.**

Verified at `cdf9063`: `AuthenticatedUser` (`packages/shared/src/auth.ts:5–15`) exposes `roles: string[]` and no permissions; `JwtAccessTokenClaims` (`packages/shared/src/jwt.ts:8–19`) likewise. There is no caller-permission signal anywhere in `apps/web`. `workspace-nav.tsx`'s doc comment and Story 129's plan both record the standing decision: the UI does not gate on permissions, and an unauthorized action surfaces its real 403.

So a non-SuperAdmin sees the button, clicks it, and gets the `forbidden` message from Task 9. That is the documented, consistent behaviour of this codebase — gating it on `roles.includes("SuperAdmin")` would hard-code a role name that admins can reconfigure, which is worse. **See Open Questions** if the reviewer wants real gating; that is its own story.

### 11 — i18n

Add to both `apps/web/messages/en.json` and `ar.json` under `customers.detail`, mirroring the existing `revokePortalAccess*` key family:

`anonymizeSubmit`, `anonymizeSubmitting`, `anonymizeConfirmTitle`, `anonymizeConfirmDescription`, `anonymizedBadge`, `anonymizeForbidden`, `anonymizeFailed`.

Arabic must be a real translation, not the English string — every existing key in this file is genuinely translated.

---

## Edge Cases & Failure Modes

| Case | Required behaviour |
| --- | --- |
| Already anonymized | 200, no-op. `anonymizedAt` **not** re-stamped. |
| Endpoint called twice | Identical end state to one call. |
| Zero contacts | Succeeds; customer fields + `isActive` + `anonymizedAt` still applied. `updateMany` affects 0 rows. |
| Multiple contacts | All anonymized in one statement. Multiple `null` emails must not violate `@@unique([customerId, email])`. |
| Contact already has null email/phone | No error; re-set to the same value. |
| Portal access already revoked (`passwordHash` null) | No error; re-set to `null`. |
| Customer outside caller's branch | 404, via `requireCustomerInScope` — same as every other customer route. |
| Caller holds only `customer:update` | **403**, from `PermissionsGuard`. |
| Unauthenticated | 401, from the global `AuthGuard`. |
| Transaction failure mid-way | Nothing is written — no half-anonymized row, no orphaned live refresh token. |
| Anonymized contact with a live access token | Locked out on the next portal request: `getAuthenticatedContact` throws because `passwordHash` is now `null`. |
| Ticket history after anonymization | Unchanged and still readable by agents. Ticket ids, statuses, SLA rows untouched. |

---

## Test Plan

**Do not weaken or skip any existing assertion to accommodate the new field.**

### API — `apps/api/src/modules/customers/customers.service.spec.ts`

1. Anonymizes the customer: `displayName` replaced, `isActive: false`, `anonymizedAt` set.
2. Anonymizes every contact: `fullName` replaced; `email`, `phone`, `preferredLocale`, `passwordHash` all `null`; `anonymizedAt` set.
3. Revokes every live refresh token (`revokedAt: null` rows only).
4. Runs as a single `$transaction` — assert the call shape, mirroring the existing `revokeContactPortalAccess` spec's approach.
5. Multiple contacts — all anonymized.
6. Zero contacts — succeeds, customer still anonymized.
7. Already anonymized — no-op, `anonymizedAt` unchanged (assert the original timestamp survives).
8. Customer out of branch scope — `NotFoundException`.

### API e2e — `apps/api/test/customers.e2e-spec.ts`

9. `POST /customers/:id/anonymize` as SuperAdmin → 200; a follow-up `GET /customers/:id` shows the anonymized values and `isActive: false`.
10. As a caller holding `customer:update` but not `customer:anonymize` → **403**.
11. Unauthenticated → 401.
12. Unknown / out-of-branch id → 404.
13. **Two contacts on one customer both anonymize without a unique-constraint violation** — the test that pins the `null`-not-placeholder decision.
14. Repeat call → 200, `anonymizedAt` unchanged.

### Portal e2e — `apps/api/test/portal.e2e-spec.ts`

15. After anonymization, portal **login** with the old credentials fails.
16. After anonymization, **refresh** with a previously-issued refresh token fails.
17. After anonymization, a **previously-issued access token** is rejected on a portal data route (e.g. `GET /portal/tickets`) — pins Task 5's claim that `getAuthenticatedContact` already covers this.

### Web — `apps/web/src/components/customers/customer-detail-view.spec.tsx`

18. The anonymize action renders for a non-anonymized customer.
19. Clicking it opens a confirmation dialog rather than committing immediately.
20. Confirming calls the real `POST /customers/:id/anonymize` mutation.
21. Pending state disables the control (double-submission guard).
22. Error state renders the `forbidden` message on a 403.
23. An already-anonymized customer shows the anonymized badge and **no** action.

### E2E — `apps/e2e/tests/customer-anonymization.spec.ts` (new)

24. **Cross-surface journey:** seed a portal contact + ticket via `createPortalContactWithTicketAsAdmin`; confirm the contact can sign in to the portal; the admin anonymizes the customer in `apps/web`; the contact's portal login now fails; **the agent can still open the ticket and see its history** in `apps/web`.

Follow the conventions P1-2 established: separate `BrowserContext`s per app (cookies are not isolated by port), `randomUUID()` fixtures, no `waitForTimeout`, assertions on the receiving surface.

---

## Migration / Rollback

- **Forward:** two additive `ADD COLUMN`s + a `pnpm prisma:seed` run to register `customer:anonymize`. No data rewrite, no downtime.
- **Rollback of the code** is safe with the columns in place — they are nullable and unread by prior code.
- **Rollback of the data is impossible**, and that is the design. Once a customer is anonymized the original `displayName`/`fullName`/`email`/`phone` are gone from the live tables. This must be stated in the confirmation dialog (Task 9) and in the documentation (below).

---

## Documentation (part of implementation, not a follow-up)

- **`README.md:549`** — the bare `- **Customer delete.**` bullet under "Roadmap / Remaining Work". Replace with an accurate entry: customer **anonymization** is implemented (Story 132); hard deletion remains deliberately unsupported because `tickets.customer_id` is `RESTRICT NOT NULL` and history must survive. Narrow the roadmap item rather than deleting it.
- **`docs/ASSESSMENT-EVIDENCE.md`** — add a row recording what is anonymized, what is **retained** (free-text bodies, S3 objects, immutable audit logs), and why anonymization was chosen over deletion. Keep the existing evidence-column style (cite the commit and the service method).
- **`docs/architecture/03-domain-boundaries.md`** — one line under Customer Management noting the anonymization lifecycle.
- Do **not** claim GDPR compliance anywhere. The honest claim is "supports an anonymization workflow for structured identity data", with the retained-data list beside it. No document makes a privacy claim today; do not create drift in the other direction.

---

## Verification Steps

```
pnpm --filter @crm/api test
pnpm --filter @crm/api test:e2e      # or: npx vitest run test/customers.e2e-spec.ts --no-file-parallelism
pnpm --filter @crm/web test
pnpm typecheck
pnpm lint
pnpm build
git status --short
```

Plus the new Playwright spec, and the full `apps/e2e` suite to confirm the seven pre-existing journeys still pass.

**Regression checks specific to this story:**

- `apps/api/test/portal.e2e-spec.ts:426` ("rejects a login for a contact whose Customer has been deactivated") must still pass — Story 100's behaviour is reused, not replaced.
- `customers.service.spec.ts` L696/L740 (set-password and revoke-access both revoke refresh tokens) must still pass unchanged.
- `apps/e2e/tests/session-expiry-and-refresh.spec.ts` must still pass — no auth-loop regression.
- `audit-log-db-grants.e2e-spec.ts:74` must still pass — audit logs stay immutable.
- Reporting tests must be unaffected: no report reads `displayName` in a way anonymization changes, but re-run them to confirm rather than assume.
- The e2e suite's own isolation defects (`CLAUDE.md` §13) remain the only acceptable pre-existing failures.

---

## Done Criteria

- [ ] `Customer.anonymizedAt` and `Contact.anonymizedAt` added as nullable columns via a hand-written, additive-only migration (zero `DROP`).
- [ ] `customer:anonymize` added to `PERMISSION_CATALOG`, granted to `SuperAdmin` only, **not** to `Agent`.
- [ ] `POST /customers/:id/anonymize` guarded by `@RequirePermissions("customer:anonymize")`; a `customer:update`-only caller gets 403.
- [ ] `anonymizeCustomer` runs as a single `$transaction`: customer renamed + deactivated + stamped; every contact renamed, `email`/`phone`/`preferredLocale`/`passwordHash` nulled, stamped; every live refresh token revoked.
- [ ] `Contact.email` is cleared to `null` (not a placeholder), and two contacts on one customer anonymize without violating `@@unique([customerId, email])` — pinned by a test.
- [ ] Idempotent: a repeat call is a 200 no-op and does not re-stamp `anonymizedAt`.
- [ ] Zero-contact and multi-contact customers both handled with no branching.
- [ ] No row is deleted; no foreign key or referential action is changed.
- [ ] Portal login, refresh, **and an already-issued access token** are all rejected after anonymization — asserted, not assumed.
- [ ] No production change to `PortalService` (the `getAuthenticatedContact`/`isActive` question is recorded, not silently resolved).
- [ ] Customer detail screen offers a distinct, `destructive`, confirm-dialog-guarded action whose copy states irreversibility **and** history retention; pending state blocks double submission; anonymized customers show a badge and no action.
- [ ] No client-side permission gating introduced.
- [ ] i18n keys added to both `en.json` and `ar.json`, Arabic genuinely translated.
- [ ] All 24 tests above written and passing; every regression check above green.
- [ ] README / ASSESSMENT-EVIDENCE / domain-boundaries updated, with the retained-data list stated plainly and no GDPR-compliance claim.
- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm build` clean.

---

## Open Questions — resolve before implementation

These are genuine decisions, not implementation details. Proceeding on a guess would be wrong for each.

1. **Placeholder wording.** Is `"Anonymized customer"` / `"Anonymized contact"` acceptable in the agent UI, or should the customer's own id be appended for supportability (e.g. `Anonymized customer 8f3a…`)? Appending an id keeps records distinguishable for support but re-introduces a per-row identifier. **This plan assumes the plain, indistinguishable form.**

2. **Retention policy.** The non-goals list (free-text bodies, S3 objects, audit-log IPs) is only defensible if the business accepts that residue. If an erasure request must reach message bodies or stored files, this story is **not sufficient** and a larger one is needed. This is the single biggest unresolved business input.

3. **The `getAuthenticatedContact` / `isActive` inconsistency.** Should a plain deactivation also invalidate already-issued access tokens immediately (adding the `isActive` check to `getAuthenticatedContact`), or is the ≤15-minute TTL window the accepted boundary? Story 132 does not depend on the answer. If the reviewer wants it closed, it should be **its own small story** so the change is reviewable on its own terms and its own portal-e2e regression risk is isolated.

4. **Client-side permission gating.** Accept the existing convention (button visible, real 403 on click), or exposure of caller permissions to the client — the latter being a new authorization model and its own story?

5. **Anonymizing a customer with open tickets.** Should the endpoint refuse, warn, or proceed silently? **This plan assumes it proceeds** — an erasure request does not wait for ticket closure — but an operations team may want a warning in the confirmation dialog.
