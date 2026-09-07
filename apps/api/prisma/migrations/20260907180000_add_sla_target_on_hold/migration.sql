-- RM-25 — SLA Pause/Resume ("On Hold" Clock).
--
-- Hand-written, not `prisma migrate dev`-generated: this repo's
-- `knowledge_base.knowledge_base_articles.search_vector` column is a real
-- Postgres GENERATED ALWAYS AS (...) STORED column that Prisma's diff
-- engine always misreads as needing an invalid `ALTER COLUMN ... DROP
-- DEFAULT` alongside any unrelated schema change — the same known
-- false-positive already worked around in every prior migration this
-- session (most recently RM-22's own `add_api_keys`). Confirmed (again)
-- via direct DB query before writing this file that no such statement
-- belongs here.
--
-- A single nullable column on an existing table in the existing `sla`
-- schema — no new schema, no grant changes needed (the `sla` schema's
-- `crm_app` grants already cover every column of every existing table).

-- AlterTable
ALTER TABLE "sla"."sla_ticket_targets" ADD COLUMN "on_hold_since" TIMESTAMP(3);
