-- Story 115 — Administration: Runtime DB role hardening.
--
-- Closes docs/architecture/05-auth-and-security.md's two, previously
-- never-implemented DB-level guarantees:
--   - "admin.audit_logs is append-only, with application DB roles denied
--      UPDATE and DELETE."
--   - "The runtime DB role cannot alter schema; a separate migration
--      role is used only by CI/deploy."
--
-- This migration is hand-written, not schema-diff-generated: it has no
-- corresponding apps/api/prisma/schema.prisma model change (Prisma
-- cannot express role/grant DDL) — running `prisma migrate dev
-- --create-only` here produced only a spurious, unrelated drift
-- (Prisma's schema-diff engine misreading Story 102's
-- `search_vector Unsupported("tsvector")` generated column, the same
-- known false-positive already documented and worked around in Story
-- 109's own migration), which has been discarded entirely.
--
-- `crm_app` is created idempotently: this migration is safe to re-run
-- against a database where it already exists (e.g. a retried
-- `prisma migrate deploy`).
--
-- The password below is a fixed, non-secret, dev/CI-only value —
-- exactly like this repository's existing `crm`/`crm_dev_password`
-- (docker-compose.yml/.env.example) and placeholder JWT secrets. A real
-- production deployment MUST rotate it before going live, e.g.:
--   ALTER ROLE crm_app WITH PASSWORD '<a real, generated secret>';
DO $$
BEGIN
  CREATE ROLE crm_app WITH LOGIN PASSWORD 'crm_app_dev_password'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END
$$;

-- Every table this application's Prisma schema currently defines lives
-- in one of these 9 schemas (`@@schema(...)` in schema.prisma). Grant
-- ordinary CRUD on all of them, then narrow exactly one table below.
-- `ALTER DEFAULT PRIVILEGES FOR ROLE crm` additionally covers every
-- FUTURE table any later migration adds in the same schema, since every
-- migration always runs as `crm` (the owner/migration role) — no
-- sequences, views, or custom functions exist anywhere in this schema
-- today (confirmed: no `autoincrement()` field, no `CREATE VIEW`/
-- `CREATE FUNCTION` in any prior migration), so table grants are the
-- entire surface.
--
-- `crm_app` is never made an owner of, nor given `CREATE` on, any
-- schema or table — only an object's owner (or a superuser) can
-- `ALTER`/`DROP` it in Postgres, and `crm_app` is neither. That is what
-- actually makes "the runtime DB role cannot alter schema" true.
GRANT USAGE ON SCHEMA "identity" TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "identity" TO crm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE crm IN SCHEMA "identity"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crm_app;

GRANT USAGE ON SCHEMA "admin" TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "admin" TO crm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE crm IN SCHEMA "admin"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crm_app;

GRANT USAGE ON SCHEMA "customers" TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "customers" TO crm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE crm IN SCHEMA "customers"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crm_app;

GRANT USAGE ON SCHEMA "ticketing" TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "ticketing" TO crm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE crm IN SCHEMA "ticketing"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crm_app;

GRANT USAGE ON SCHEMA "sla" TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "sla" TO crm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE crm IN SCHEMA "sla"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crm_app;

GRANT USAGE ON SCHEMA "notifications" TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "notifications" TO crm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE crm IN SCHEMA "notifications"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crm_app;

GRANT USAGE ON SCHEMA "knowledge_base" TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "knowledge_base" TO crm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE crm IN SCHEMA "knowledge_base"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crm_app;

GRANT USAGE ON SCHEMA "ai" TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "ai" TO crm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE crm IN SCHEMA "ai"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crm_app;

GRANT USAGE ON SCHEMA "channels" TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "channels" TO crm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE crm IN SCHEMA "channels"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crm_app;

-- The one documented special case: the audit trail must be append-only
-- from the application's point of view. `crm_app` keeps SELECT/INSERT
-- (it still needs to read and write new entries) but loses UPDATE/DELETE
-- specifically on this table.
REVOKE UPDATE, DELETE ON "admin"."audit_logs" FROM crm_app;
