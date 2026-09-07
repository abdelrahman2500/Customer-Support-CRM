-- RM-24 — Round-Robin / Load-Based Automatic Assignment.
--
-- Hand-written, not `prisma migrate dev`-generated: this repo's
-- `knowledge_base.knowledge_base_articles.search_vector` column is a real
-- Postgres GENERATED ALWAYS AS (...) STORED column that Prisma's diff
-- engine always misreads as needing an invalid `ALTER COLUMN ... DROP
-- DEFAULT` alongside any unrelated schema change — the same known
-- false-positive already worked around in every prior migration this
-- session (most recently RM-25's own `add_sla_target_on_hold`). Confirmed
-- (again) via direct DB query before writing this file that no such
-- statement belongs here.
--
-- Two new columns on an existing table in the existing `sla` schema — no
-- new schema, no grant changes needed. Both are backward-compatible
-- additions: `action_assignment_mode` defaults to 'FIXED' and
-- `eligible_agent_pool` defaults to '{}', so every existing row keeps its
-- exact current behavior with no backfill needed.

-- CreateEnum
CREATE TYPE "sla"."AutomationActionAssignmentMode" AS ENUM ('FIXED', 'LEAST_LOADED');

-- AlterTable
ALTER TABLE "sla"."automation_rules"
  ADD COLUMN "action_assignment_mode" "sla"."AutomationActionAssignmentMode" NOT NULL DEFAULT 'FIXED',
  ADD COLUMN "eligible_agent_pool" TEXT[] NOT NULL DEFAULT '{}';
