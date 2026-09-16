**Source:** manual entry (tracker skipped via `--no-tracker`).

> Active tracker for this workspace: `github` — this story is not linked.

> Run `squad tracker link <story-path> <tracker-id>` later if you want to attach one.

# Story intake

- Folder: `.squad/stories/customer-data-anonymization/customer-data-anonymization/intake.md`

- Binaries (screenshots, PDFs, exports): put them in `attachments/` next to this file and list them below.

- Do **not** rely on external links (tracker URLs, wiki, chat) — the planner cannot open them. Paste the content you want considered.

This is **not** an implementation prompt. It is the input to the plan-generation meta-prompt bundled with squad-kit (`generate-plan.md` in the installed package).

---

## Feature

`customer-data-anonymization`

Customer Management domain (`docs/architecture/03-domain-boundaries.md`).

## Tracker (metadata only)

- Type: `github`
- Work item id: _(none — entered manually, not linked)_

## Title

Customer Data Anonymization / Right-to-Erasure

## Description

The CRM stores real personal data about customers and their contacts — display
name, full name, email, phone, portal password hash, locale preference — and
exposes a customer-facing portal those people authenticate into. There is
currently **no way to remove or obscure any of it.**

A read-only audit at commit `cdf9063` established exactly what exists today:

- `Customer.isActive` can be toggled through `PATCH /customers/:id`, and it is
  genuinely enforced — `PortalService.login` (`portal.service.ts:55`) and
  `PortalService.refresh` (`:90`) both reject a contact whose Customer is
  inactive (Story 100).
- A contact's portal access can be revoked through
  `PATCH /customers/:id/contacts/:contactId/portal-access/revoke`, which nulls
  `passwordHash` and revokes every live refresh token in one transaction
  (`customers.service.ts:351–369`).
- **No `DELETE` endpoint exists for `Customer` or `Contact`** anywhere in the
  API. The only `@Delete` routes in the repository belong to sessions,
  api-keys, webhook-subscriptions, dashboards, tasks and kb-references.
- **No anonymization/erasure workflow exists**, and there are **zero tests**
  for customer or contact deletion, anonymization or cascade behaviour.

So the product has an *access* lifecycle but no *data* lifecycle. A customer
can be switched off; their personal data cannot be removed.

**Hard deletion is not the answer here, and the schema already says so.**
Verified against the live database (`pg_constraint`), not inferred from Prisma
defaults:

- `ticketing.tickets.customer_id → customers.customers` is **RESTRICT, NOT
  NULL**. Any customer who has ever had a ticket cannot be deleted at all.
  Since having tickets is the entire point of a CRM customer, hard deletion is
  effectively impossible for every real customer.
- `ticketing.ticket_csat_responses.submitted_by_contact_id → customers.contacts`
  is **RESTRICT, NOT NULL** — the same block at contact level.
- Several relations are **CASCADE**, so a forced delete would silently destroy
  records nothing asked to lose: `customer_notes`, `customer_attachments`,
  `notification_logs`, `contact_refresh_tokens`,
  `portal_notification_preferences`, and entire `ai.chat_sessions` histories.

Meanwhile the schema already anticipates the *opposite* shape:
`Ticket.contactId`, `ChannelMessage.senderContactId` and
`TicketAttachment.uploadedByContactId` are all **nullable with SET NULL** — a
contact can detach from history while the history survives. `Contact.email` is
nullable, and `@@unique([customerId, email])` tolerates multiple NULLs in
PostgreSQL.

This story therefore specifies **in-place anonymization**, not deletion:
overwrite/clear the structured identifying fields, cut off portal access,
stamp the event, and leave ticket/SLA/reporting history intact and
attributable by id.

## Acceptance criteria

### Data model

- `Customer` gains `anonymizedAt DateTime?` (nullable, no default).
- `Contact` gains `anonymizedAt DateTime?` (nullable, no default).
- The migration is **additive only** — two `ADD COLUMN` statements, zero
  `DROP`, zero data rewrite, no change to any existing column, constraint or
  referential action.
- No existing row changes meaning on upgrade: `NULL` means "never
  anonymized", which every existing row correctly is.

### Permission

- A new permission key `customer:anonymize` is added to `PERMISSION_CATALOG`
  in `apps/api/prisma/seed.ts`.
- It is granted to `SuperAdmin` only. It is **not** added to the `Agent`
  role's grant list, which already holds `customer:update`.
- The seed reconciles it onto existing databases the same way every other
  permission is (delete-then-recreate transaction, already in place).

### API

- `POST /customers/:id/anonymize`, guarded by
  `@RequirePermissions("customer:anonymize")`.
- A caller holding only `customer:update` receives **403**, and this is
  asserted by a test. Reusing `customer:update` is explicitly rejected: it is
  needed for routine edits like correcting a phone number, and an irreversible
  erasure must not ride on that.
- The whole operation runs in **one `prisma.$transaction`** — either every
  field is anonymized and every token revoked, or nothing changes.
- The endpoint is **branch-scoped** exactly like every other customer route
  (`requireCustomerInScope`), and returns 404 for a customer outside the
  caller's branch.

### What the operation does

Within the single transaction, for the target `Customer` and **every** one of
its `Contact` rows:

- `Customer.displayName` is replaced with a stable, non-identifying
  placeholder.
- `Customer.isActive` is set to `false`.
- `Customer.anonymizedAt` is stamped with the transaction time.
- Each `Contact.fullName` is replaced with a stable, non-identifying
  placeholder.
- Each `Contact.email` is set to `null`.
- Each `Contact.phone` is set to `null`.
- Each `Contact.preferredLocale` is set to `null`.
- Each `Contact.passwordHash` is set to `null` (portal access removed).
- Each `Contact.anonymizedAt` is stamped with the same timestamp.
- Every `ContactRefreshToken` for those contacts with `revokedAt: null` is
  revoked (`revokedAt` set) — **updated, not deleted**, mirroring
  `revokeContactPortalAccess`'s existing precedent so the token audit trail
  survives.

### What the operation must NOT do

- It must not delete the `Customer`, any `Contact`, or any historical row.
- It must not touch `Ticket`, `TicketHistoryEntry`, SLA rows, or anything
  reporting reads. Ticket ids, statuses, timestamps and SLA outcomes are
  unchanged, so history stays complete and reports stay correct.
- It must not alter any foreign key or referential action.

### Idempotency and edge cases

- Calling the endpoint on an **already-anonymized** customer succeeds and is a
  no-op with respect to already-cleared fields; `anonymizedAt` is **not**
  re-stamped (the first anonymization is the real event). Returns 200.
- Calling it **twice in a row** produces the same end state as calling it once.
- A customer with **zero contacts** anonymizes successfully — the customer's
  own fields and `isActive`/`anonymizedAt` are still applied.
- A customer with **multiple contacts** anonymizes all of them. Clearing
  `email` to `null` across several contacts must not violate
  `@@unique([customerId, email])` — PostgreSQL permits multiple NULLs, and a
  test must pin this rather than assume it.
- Contacts that **already** have `null` email/phone are unaffected and cause no
  error.
- A contact whose **portal access was already revoked** (`passwordHash` already
  `null`) is unaffected and causes no error.

### Portal / session behaviour

- After anonymization, portal **login** and **refresh** are already blocked by
  the existing `customer.isActive` checks — this must be asserted, not assumed.
- `PortalService.getAuthenticatedContact` (`portal.service.ts:113–116`)
  currently checks `passwordHash` but **not** `customer.isActive`. Because
  anonymization nulls `passwordHash`, that method already throws for an
  anonymized contact — so the erasure case is covered by the existing check.
- The audit separately found that a **deactivation alone** (`isActive: false`
  without revoking access) leaves an already-issued access token usable on
  portal data routes until it expires (≤15 min). Whether to close that gap is
  a **decision for the reviewer**, recorded in the plan's Open Questions — it
  is not required for this story's own correctness and must not be silently
  bundled in.
- No auth-loop regression: the portal's existing `apiFetch → 401 → refresh
  fails → auth-expired → /login?reason=session-expired` recovery must behave
  exactly as `apps/e2e/tests/session-expiry-and-refresh.spec.ts` already pins.

### UI

- An "Anonymize customer" action on the customer detail screen, visually and
  positionally **distinct** from the ordinary edit fields and from the
  active/inactive toggle.
- `destructive` button variant, guarded by the existing shared `ConfirmDialog`.
- The confirmation copy must state plainly that the action is **irreversible**
  and that **ticket history is retained**.
- Pending state disables the control and shows a submitting label, so the
  action cannot be double-submitted (mirrors the existing revoke-portal-access
  control).
- Success and error feedback use the existing `useErrorMessage()`
  `forbidden`/`generic` convention.
- Once `anonymizedAt` is set, the screen shows an anonymized state and does not
  offer the action again.
- **Permission-based visibility:** the web app has no client-side permission
  signal today — `AuthenticatedUser` (`packages/shared/src/auth.ts:5–15`) and
  the JWT claims carry `roles`, never `permissions`. The established
  convention, documented in `workspace-nav.tsx`'s own comment and reaffirmed
  by Story 129, is that the UI does **not** gate on permissions and a
  forbidden action surfaces its real 403. This story follows that convention
  and does **not** introduce client-side permission gating. See Open Questions.

### Auditability

- The operation is recorded by the existing global `AuditInterceptor`
  (mutating method + route + actor + IP), with no new audit mechanism.
- `Customer.anonymizedAt` / `Contact.anonymizedAt` are themselves the durable,
  queryable record that the erasure happened and when.

### Verification

- API unit + e2e, portal e2e, web component tests, and one Playwright
  cross-surface journey — enumerated in the plan's Test Plan.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` clean.

## Attachments

_(none)_

## Dependencies

- **Story 06** — `customer-management`: the `Customer`/`Contact` models,
  `CustomersService`, branch scoping (`requireCustomerInScope`).
- **Story 52** — portal contact authentication: `Contact.passwordHash`,
  `ContactRefreshToken`, `PortalService`.
- **Story 100** — customer deactivation gating portal login/refresh. This
  story reuses that enforcement rather than adding a second mechanism.
- **Story 03 / identity** — `PERMISSION_CATALOG`, `ROLE_GRANTS`,
  `@RequirePermissions`, `PermissionsGuard`.
- **Story 114 / P1-2** — `apps/e2e` Playwright harness and
  `tests/support/api-client.ts` fixture helpers.

## Extra notes (optional)

- This is a **compliance-shaped** gap, not a CRUD gap. The audit classified it
  as a significant feature gap at roughly P1 — nothing is broken and no data is
  at risk, but a CRM with a customer-facing portal has no way to satisfy a
  deletion request.
- The repository is honest about this today: `README.md:549` carries a bare
  `- **Customer delete.**` bullet under "Roadmap / Remaining Work", and no
  document anywhere claims GDPR compliance, retention policy, or erasure. A
  search across `docs/` and `README.md` for
  `gdpr|anonymi[sz]|right to be forgotten|erasure|data retention|pii` returns
  that single line. **There is no documentation drift to correct** — only a
  documentation *update* once this ships.

## Technical hints (optional)

- `revokeContactPortalAccess` (`customers.service.ts:351–369`) is the closest
  existing precedent for the transactional shape: a `$transaction([...])` that
  nulls a field and revokes tokens together. Mirror it rather than inventing a
  new pattern.
- Migration naming follows `YYYYMMDDHHMMSS_snake_case_description` (see
  `20260915000000_add_notification_template_is_active`).
- `Contact.email` is nullable and `@@unique([customerId, email])` permits
  multiple NULLs in PostgreSQL. Setting emails to a **placeholder string**
  instead would collide on the second contact — clear to `null`, do not
  substitute.
- `ContactRefreshToken.revokedAt` is nullable; the existing revoke path uses
  `updateMany({ where: { contactId, revokedAt: null }, data: { revokedAt } })`.

## Out of scope

The following are **retained data**, deliberately, and this story must not
imply otherwise. Each is either architecturally protected or a materially
harder problem deserving its own decision:

- **`ChannelMessage.body`** — free text a customer wrote into a ticket
  conversation. May contain identifiers; scrubbing it is a different problem
  from clearing structured fields.
- **`ChatMessage.body`** — AI chat turns, same reasoning.
- **`CustomerNote.body`** — agent-authored notes *about* the customer.
- **`TicketCsatResponse.comment`** — free-text survey feedback.
- **Uploaded file contents / S3 objects** — `TicketAttachment` and
  `CustomerAttachment` filenames and their stored binaries. Purging object
  storage is a separate operational concern.
- **`admin.audit_logs`** — immutable by design. Application DB roles are denied
  `UPDATE` and `DELETE`
  (`docs/architecture/05-auth-and-security.md:17,19`, pinned by
  `apps/api/test/audit-log-db-grants.e2e-spec.ts:74`). The global interceptor
  records actor id and IP on every mutating request including portal routes, so
  a contact's IP persists there. *Mitigating:* that interceptor stores only
  method + route + IP and explicitly no request body
  (`audit.interceptor.ts:22–24`), and every semantic `diff` writer lives in
  `identity.service.ts` (agent users) — so **no customer name, email or phone
  is stored in audit diffs.**

Also out of scope:

- Hard deletion of `Customer` or `Contact`, in any form.
- Any change to foreign keys, referential actions, or cascade behaviour.
- A self-service erasure request flow in `apps/portal` — this is an
  admin-initiated operation only.
- Bulk/multi-customer anonymization.
- A data-export ("right to access") counterpart.
- Un-anonymization / restore. The action is irreversible by design.
- Automatic retention-based expiry or scheduled anonymization.
