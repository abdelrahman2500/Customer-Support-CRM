# Assessment Evidence

This document exists to answer, in one place and with citable evidence, the
questions a project assessment asks about *how* this repository was built,
not just what it contains. It is a durable artifact, not a one-time report —
update it as the project's development approach or verification status
materially changes, rather than letting it drift the way `README.md`'s
"Current capabilities" section was found to have drifted (see
"Documentation drift" note at the end of this file).

Every claim below cites either a command actually run, a specific commit
hash, or a specific file in this repository. Where something could not be
verified from the repository alone, that is stated explicitly rather than
asserted.

## 1. AI + Spec-Driven Development (SDD) workflow

This repository was built end-to-end by Claude Code operating under a
durable, project-level instruction set: [`CLAUDE.md`](../CLAUDE.md) (repo
root). That file — not a one-off prompt — defines a continuous,
unattended **Story loop**: recon the repository → select the next Story →
plan it → implement it → verify it → commit it (one Story, one commit) →
push it → report → recon again. It explicitly delegates the "should I
continue / which Story / should I commit / should I push" decisions so the
loop does not stall on avoidable confirmation requests, while reserving
real stops for genuine external blockers (`CLAUDE.md` §9).

Requirements were converted into implementation work through
**squad-kit's planning convention**, recorded under [`.squad/`](../.squad/):

- [`.squad/plans/00-index.md`](../.squad/plans/00-index.md) is the
  authoritative, git-history-cross-checked index of every Story that has
  shipped — currently around 160 rows (numbered Stories, `RM-NN` roadmap
  items, and disclosed "`(unplanned)`" direct-implementation entries where
  a change was self-evidently small enough to skip a formal plan, per
  `CLAUDE.md` §3).
- Each planned feature has a `.squad/plans/<feature-slug>/00-overview.md`
  plus per-story `NN-story-*.md` files (goal, non-goals, design decisions,
  files expected to change, acceptance criteria, verification plan), and a
  matching `.squad/stories/<feature-slug>/.../intake.md`.
- A cross-cutting example of SDD in practice:
  [`.squad/plans/core-completion-roadmap/`](../.squad/plans/core-completion-roadmap/)
  re-verified the repository against a prior "Core Features Recon,"
  produced a full gap matrix (`01-core-gap-matrix.md`), explicit
  provider/zero-cost decision records (`02-product-decisions.md`), and a
  dependency-ordered roadmap (`03-dependency-graph.md`) — the specification
  work was written down and cross-checked against existing plans *before*
  any of its 26 proposed stories (`RM-00`…`RM-25`) were implemented, to
  avoid duplicating work already done (see that folder's own
  "Re-verification" section for concrete examples of gaps it found were
  narrower than initially assumed).

Squad/Claude were used as the actual implementation loop, not merely for
scaffolding: every Story's commit in `git log` was authored with the
`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer, and
Story-shaped commit messages (`feat(story-NN): ...`, `feat(rm-NN): ...`)
routinely include the verification commands run and their results (e.g.
commit `9cd542e`'s message states the exact e2e run it performed — see
§3 below).

## 2. Verification strategy

The project's own objective definition of "verified" is
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml): install → Prisma
generate → lint → typecheck → build → unit tests → API e2e tests (against
real Postgres/Redis/MinIO service containers), with a separate
`browser-e2e` job (builds `apps/api`/`apps/web`/`apps/portal`, then runs the
Playwright suite against them) and a separate Docker-image-build job (build
only, no push — no container registry has been chosen; see
`docs/architecture/12-risks-tradeoffs-and-scope.md`).

Every Story's own plan document includes an explicit verification-plan
section (see `CLAUDE.md` §5 and any `.squad/plans/**/NN-story-*.md` file),
listing the exact commands expected to pass before that Story is
considered done — the same commands are reproduced in §3 below.

## 3. Test / lint / typecheck / build evidence

**Explicitly verified in the most recent finalization recon session**
(commands actually executed, real output captured — not simulated):

| Check | Command | Result |
|---|---|---|
| Lint | `pnpm lint` | **PASS** — 0 errors, 0 warnings (10/10 turbo tasks) |
| Typecheck | `pnpm typecheck` | **PASS** — 0 errors (10/10 turbo tasks) |
| Full build | `pnpm build` | **PASS** (6/6 buildable packages) |
| API unit | `pnpm --filter @crm/api test` | **PASS** — 88 files / **1336 tests** |
| Worker unit | `pnpm --filter @crm/worker test` | **PASS** — 17 files / **133 tests** |
| Worker e2e | `pnpm --filter @crm/worker test:e2e` | **PASS** — 4 files / **6 tests** |
| Web unit | `pnpm --filter @crm/web test` | **PASS** (isolated rerun — 75/76 files clean on the first concurrent run, the one apparent failure reproduced as a resource-contention timeout and passed cleanly, 23/23, when rerun alone) |
| Portal unit | `pnpm --filter @crm/portal test` | **PASS** — 40 files / **297 tests** |
| Browser e2e (Playwright) | `pnpm --filter @crm/e2e test` | **PASS** — 2/2 tests |
| Docker build — api | `docker build -f apps/api/Dockerfile .` | **PASS** — image built, 267MB |
| Docker build — worker | `docker build -f apps/worker/Dockerfile .` | **PASS** — image built, 266MB |
| Docker build — web/portal | not run | **Not attempted** this session (time budget — each build was estimated to add ~10–15 minutes on top of an already long session; not a known failure) |

**Previously verified (not in this session, but with citable repository
evidence), and why it was not rerun:**

| Check | Status | Evidence |
|---|---|---|
| Full API e2e suite (`pnpm --filter @crm/api test:e2e`) | **Blocked / not rerun this session** | Prisma CLI v6.19.3 itself refused `migrate reset --force` against the isolated `crm_test` database, detecting an AI-agent invocation and requiring a human to explicitly set `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`. This is a built-in Prisma safety guardrail, not a repository script, and it was correctly *not* bypassed. **The last known-good run of this exact suite is documented in commit `9cd542e`'s own message** ("isolate e2e test database from local dev database," dated 2026-09-09, five commits before the current `HEAD`): *"ran the full `pnpm test:e2e` suite (54 files / 740 tests passed) via the wrapper."* Only small, disclosed non-schema-affecting commits (navigation/loading polish, a CSAT null-handling fix, one ESLint config change) have landed since that run — no ticket/SLA/identity/knowledge-base/portal domain logic changed. Treat this as **strong but not current-session** evidence, not as "verified today." |
| CI green on GitHub Actions | **Not directly observed** | `.github/workflows/ci.yml`'s configured steps were cross-checked against this session's own local run and matched; no GitHub Actions run log was fetched or inspected as part of this documentation pass. Do not cite a specific CI run number without pulling the actual Actions history. |

**Intentionally deferred / known, disclosed limitations (not verification
gaps):**

- `identity.e2e-spec.ts` has pre-existing, disclosed test-isolation bugs
  (`CLAUDE.md` §5/§13) — a small number of e2e failures reproducible only
  when the full suite is run repeatedly against the same persistent dev
  database, unrelated to any specific Story's own correctness. Not fixed
  opportunistically, per `CLAUDE.md`'s own scope-discipline rule.

## 4. Ownership and decision-making evidence

- `CLAUDE.md` itself is a durable ownership artifact: it commits, in
  writing, to specific autonomous-decision boundaries (§1, §9), a specific
  Git policy including a "never force-push / never rewrite history / never
  weaken a test to pass" set of hard constraints (§6, §11), and explicit
  handling for one messy piece of real history (§7 — a commit that
  predates the one-commit-per-Story policy is documented and left alone
  rather than rewritten).
- Deferred-scope decisions are recorded, not silently skipped:
  `.squad/plans/core-completion-roadmap/02-product-decisions.md` contains
  explicit decision records for the Email/WhatsApp/SMS provider question
  and the ERP/Integrations question, under a stated zero-cost/no-paid-
  service constraint — this is why WhatsApp/SMS/ERP remain unimplemented
  today (see §6 below), not an oversight.
- Known defects are disclosed rather than hidden:
  `CLAUDE.md` §13 names the `identity.e2e-spec.ts` isolation bugs
  specifically, states why they weren't fixed, and gives the exact
  recovery command (`pnpm prisma:seed`).
- `.squad/plans/00-index.md` documents its own gaps honestly, including two
  known-empty/never-completed plan-folder scaffolds
  (`slabusiness-hours-awaretargetcomputation`, `test`) left in place rather
  than deleted, with an explanation of why each is harmless.

## 5. Major architectural trade-offs

Recorded in full, with rationale and a "revisit when" trigger, in
[`docs/architecture/12-risks-tradeoffs-and-scope.md`](./architecture/12-risks-tradeoffs-and-scope.md).
Summary:

| Trade-off | Choice made | Why |
|---|---|---|
| Modular monolith vs. microservices | Modular monolith, in-process domain events | Avoids distributed-systems complexity while preserving future extraction |
| One database vs. database-per-domain | One Postgres instance, logical schemas | Cheaper to operate, supports cross-domain reporting |
| REST vs. GraphQL | REST + OpenAPI | Fits CRUD/workflow operations |
| Self-hosted auth vs. vendor | JWT + RBAC | Controls branch claims/audit without vendor billing |
| Build vs. buy channels | Buy provider delivery, build orchestration | Channel delivery is not the product's value |
| AI vendor | Anthropic Claude behind an `AiProvider` interface | Quality with provider portability |
| Search | Postgres `tsvector` (implemented) + `pgvector` (declared, unused) | Avoid infra until a measured relevance/latency need exists |
| Multi-branch vs. multi-company | Single `Organization → Branch → Department` | Matches the actual single-company requirement |

That same document's "Explicit non-goals of this foundation story" section
was, until this documentation pass, an unqualified, undated list from
Story 02 that read as if it still described current scope (it did not — it
predates nearly the entire feature set now built). It has been annotated
with a historical-scope note rather than deleted, so the original planning
record is preserved.

## 6. Deferred scope, and why

| Deferred item | Why | Evidence |
|---|---|---|
| WhatsApp / SMS channel adapters | Blocked on choosing an external paid provider; `core-completion-roadmap`'s own decision record treats this under a zero-cost constraint | `docs/architecture/09-integrations.md`; `.squad/plans/core-completion-roadmap/02-product-decisions.md`; `ChannelAdapterRegistry` explicitly documents these as unregistered "until a Phase 5 story registers one" |
| ERP adapters | No ERP/protocol has been named; the generic `ErpAdapter` interface pattern is designed but not implemented | `docs/architecture/09-integrations.md` |
| Inbound-webhook → domain-event translation | The receiver/verification framework (RM-21) is real and tested, but translating a verified payload into a `ChannelMessage`/ticket is explicitly named as that story's own disclosed non-goal, deferred to whichever future provider-specific story registers a real verifier | `apps/api/src/modules/integrations/webhook-inbound.service.ts`'s own doc comment |
| Machine-callable surface beyond one read-only report | The API-key guard (HMAC-hashed, scoped, tenant-bound, RM-22) is wired to a real production endpoint as of Story 133: `GET /integrations/reports/ticket-volume`, read-only JSON, requiring the `integration:read` scope and confined to the key's own branch via the same `TenantContext.requireBranchScope()` flow human callers use. Deliberately narrow — one report family, no CSV export, no write endpoint. Widening it is a separate decision, not an oversight | `MachineReportingController` in `apps/api/src/modules/reporting/machine-reporting.controller.ts`; `apps/api/test/machine-reporting.e2e-spec.ts` (branch isolation, scope rejection, revoked/expired key, `crossBranch=true` → 403) |
| Vector-based (embeddings) Knowledge Base retrieval for AI ticket-assist and the portal chatbot | Lexical KB grounding is implemented for both surfaces: the worker retrieves up to three published, branch-scoped articles via PostgreSQL `tsvector` full-text search and passes them to the provider as context. Only the vector-based upgrade is deferred — it needs an external embeddings-provider decision, and Anthropic exposes no embeddings endpoint. Agent-facing output remains advisory (human-in-the-loop), by design | `f4af9dc` (portal chatbot grounding, Story 117) and `50bdf22` (ticket-assist Suggested Solutions, RM-00); `AiProcessingProcessor.fetchKnowledgeBaseContext` in `apps/worker/src/queues/ai-processing.processor.ts`; no `vector`-typed column exists in `apps/api/prisma/schema.prisma` |
| Customer hard deletion, and erasure of historical free text / uploaded files | Customers are **anonymized in place** instead (Story 132): one transactional `POST /customers/:id/anonymize`, behind its own `customer:anonymize` permission, clears the customer's and every contact's name/email/phone/portal password, revokes live refresh tokens, deactivates the customer and stamps `anonymizedAt`. Hard deletion is not offered because the schema forbids it — `tickets.customer_id` is `RESTRICT NOT NULL`, so a customer with any ticket cannot be deleted, and six related relations are `CASCADE`, so forcing it would destroy customer notes, attachments, notification logs, portal preferences and AI chat sessions. Deliberately **retained**, not erased: `ChannelMessage.body`, `ChatMessage.body`, `CustomerNote.body`, `TicketCsatResponse.comment`, uploaded S3 objects, and the immutable `admin.audit_logs` | `CustomersService.anonymizeCustomer` in `apps/api/src/modules/customers/customers.service.ts`; `POST /customers/:id/anonymize` in `customers.controller.ts`; FK actions verified against `pg_constraint`; portal lock-out asserted by `apps/api/test/portal.e2e-spec.ts` and the cross-surface journey `apps/e2e/tests/customer-anonymization.spec.ts` |
| Production hosting platform decision | Not made — the platform is cloud-agnostic through containers, but no specific host has been chosen | `docs/architecture/12-risks-tradeoffs-and-scope.md` |

## 7. Current completion status

See the root [`README.md`](../README.md)'s "Current capabilities" and
"Project Status" sections for the up-to-date, per-domain implementation
status (kept in sync with this document as of this finalization pass). At
a high level: every domain in
`docs/architecture/03-domain-boundaries.md`'s domain table has a real,
working implementation except the externally-provider-blocked pieces named
in §6 above.

## 8. Productivity / throughput narrative

Based on `git log` alone, without inventing metrics:

- **228 commits** from the first commit (`40487c2`, 2026-08-24) to the
  current `HEAD` (`09a3328`, 2026-09-09) — a **16-day** span.
- Roughly **130 sequentially numbered Stories** (per
  `.squad/plans/00-index.md`'s `NN` column) plus a **26-story `RM-00`–
  `RM-25` roadmap batch** plus **5 further `RM-26`–`RM-30` stories**
  plus several dozen smaller, disclosed "`(unplanned)`" direct-
  implementation commits — all traceable to a real commit hash.
- Delivered across **4 runtime applications** (`apps/api`, `apps/web`,
  `apps/portal`, `apps/worker`) and **2 shared packages**
  (`packages/ai`, `packages/shared`), with **52 Prisma models** across
  **12 logical schemas**, **1336 API unit tests**, **133 worker unit
  tests**, **54 API e2e spec files** (last known count: 740 tests, per
  `9cd542e`), and **2 browser e2e flows** — while keeping `pnpm lint` /
  `pnpm typecheck` / `pnpm build` green throughout (verified again in this
  pass; see §3).
- One dedicated commit per completed Story since `CLAUDE.md` took effect
  (§6/§7 of that file), giving a git history that is itself a readable,
  auditable implementation timeline rather than a squashed/rebased one.

No claim above is a projection or an estimate presented as fact — every
number is directly countable from the repository as it stands.

## 9. Documentation drift (context for this file's own existence)

This file was added as part of a documentation/evidence finalization
pass that also corrected several places where `README.md` had fallen out
of sync with the actual implementation (in every case, the drift
*understated* what had shipped — e.g. the README described Knowledge Base
search as "a plain substring match" after it had been replaced with real
PostgreSQL full-text search, and described the Integrations domain as
"planned, not implemented" after API keys and outbound webhooks were
already built and tested). See the corrected `README.md` sections
("Current capabilities", "Project Status", "Roadmap") for the present,
verified status, and treat any future drift the same way: fix the
specific incorrect sentence, cite the evidence that corrects it, and note
here if the correction is itself notable.
