# audit-log-db-grants — plan overview

Entry point for the **audit-log-db-grants** feature.

## Stories

| NN  | File | Title | Tracker id | Depends on |
| --- | --- | --- | --- | --- |
| 115 | [115-story-audit-log-db-grants.md](./115-story-audit-log-db-grants.md) | Administration — Runtime DB role hardening (audit-log append-only + schema-alter denial) | — | Story 02 (monorepo scaffolding — the original, never-enforced doc/schema comment), Story 84 (identity-audit-logging — the application-level half this closes the DB-level half of) |

## Dependency notes

- Selected via a fresh whole-repository Recon after the unplanned
  `fix(sla-e2e)` commit, from the standing, user-approved unblocked
  backlog (110 saved dashboards, 115 audit-log DB grants). Applying
  CLAUDE.md §2's strict, lexicographic priority order:
  1. **Dependency correctness** — tie; neither candidate unblocks other
     backlog work.
  2. **Architectural coherence — decides it.** This story fits exactly
     what is already documented
     (`docs/architecture/03-domain-boundaries.md`'s `admin` row: "Owns
     audit storage"; `docs/architecture/05-auth-and-security.md` lines
     17 and 26) and needs no new abstraction — it closes a gap between
     the *written* architecture and the *actual* implementation using
     existing schema/module boundaries. Story 110 (saved dashboards)
     requires inventing a widget/layout/sharing data model that is named
     only as a two-word phrase in one domain-boundary table cell and
     specified nowhere else in `docs/architecture/**` — exactly the kind
     of speculative-abstraction risk §2's coherence criterion warns
     against building without real design work first.
  Because §2 is strict (each criterion decides only among ties left by
  the previous one), this story wins outright at step 2 — it is also
  independently favored on risk reduction (a currently-false security
  claim about a tamper-resistant audit trail) and smallness (an
  infra/migration change, no new product surface).
- **The gap, confirmed directly**: `apps/api/prisma/schema.prisma`'s
  `AuditLog` model has carried this doc comment, unmodified, since
  Story 02 (`project-foundation`):
  > "Append-only audit log. The application's runtime DB role must be
  > granted INSERT/SELECT only on this table (no UPDATE/DELETE) — see
  > docs/architecture/05-auth-and-security.md. Enforcing that grant is a
  > deployment/DBA task tracked as a follow-up (see Story 02 plan's Done
  > Criteria); Prisma itself cannot express column/row privileges."
  Confirmed via `docker-compose.yml`, `.github/workflows/ci.yml`, both
  apps' `env.validation.ts`, and every file under
  `apps/api/prisma/migrations/**`: exactly one Postgres role (`crm`) is
  used everywhere — schema DDL, all application CRUD, and the audit-log
  writes — with a single `DATABASE_URL`. No `GRANT`/`REVOKE`/`CREATE
  ROLE` statement exists anywhere in the repository. Story 84
  (`identity-audit-logging`) closed the *application-level* half
  (explicit audit writes for login/logout/permission-diffs) and
  explicitly scoped out any DB/schema change in its own plan doc. The
  DB-level half of `docs/architecture/05-auth-and-security.md`'s
  documented guarantee ("append-only... denied UPDATE and DELETE"; "the
  runtime DB role cannot alter schema") has never been implemented.
- **Why not externally blocked**: purely internal DB/infra work — no
  external provider/credential decision needed.
- **Design decisions this story makes** (see the story doc's own Design
  section for full detail and rationale):
  - A single new, shared Postgres role (`crm_app`) used by both
    `apps/api` and `apps/worker` at runtime — not a separate role per
    app. `docs/architecture/05-auth-and-security.md` describes one
    "runtime DB role," singular, and every schema this role needs
    access to is already shared across both apps' own modules (SLA,
    notifications, AI, ticketing).
  - Role creation and every grant/revoke are done entirely inside a
    single, idempotent Prisma migration (raw SQL) — not a
    `docker-entrypoint-initdb.d` init script. An init script only runs
    on a Postgres container's first-ever startup against an empty data
    volume; it would silently no-op for this repository's own existing,
    already-provisioned local dev volumes (and any already-running
    deployment), leaving the guarantee unenforced exactly where it's
    needed most. A migration applies uniformly everywhere `prisma
    migrate deploy` already runs (fresh or existing databases, local
    dev, CI, real deployments).
  - `APP_DATABASE_URL` is a new, **optional** env var in both apps'
    `env.validation.ts` (falls back to the existing `DATABASE_URL` when
    unset) — not a new required variable. A required addition would
    fail startup for every already-configured environment the instant
    this change lands, including this repository's own long-running
    local dev setup, which is exactly the kind of disruptive,
    non-backward-compatible change CLAUDE.md's safety rules forbid.
    Going forward, this repository's own `.env.example` and
    `.github/workflows/ci.yml` are updated to set `APP_DATABASE_URL` to
    the new restricted role's connection string by default — so the
    committed reference configuration is secure-by-default, while an
    existing, un-updated local `.env` keeps working unchanged (under the
    owner role) until its owner opts in.
  - `DATABASE_URL` (the existing, unchanged variable) keeps meaning
    "the migration/owner role" — used only by `prisma migrate
    deploy`/`prisma:seed`/CI's migration step, exactly as
    `docs/architecture/05-auth-and-security.md` line 26 already
    describes.
- **Scope-narrowing decisions** (see the story doc's own Non-Goals for
  the full list): no per-table/per-schema fine-grained permission model
  beyond the one documented special case (`admin.audit_logs`); no
  row-level security; no credential-rotation tooling; no change to how
  `prisma:seed` or `prisma migrate deploy` authenticate (both keep using
  the owner role, unchanged).
