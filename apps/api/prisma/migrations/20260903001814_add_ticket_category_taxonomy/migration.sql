-- Story 120 — Managed Category Taxonomy
--
-- Replaces the four free-text category columns (tickets.category,
-- sla_policies.category, automation_rules.condition_category,
-- automation_rules.action_set_category) with a real, branch-scoped
-- ticketing.ticket_categories foreign key. Zero-loss backfill: one
-- TicketCategory row is created per exact, distinct (branch_id, value)
-- pair found across all four legacy columns — no normalization, no
-- merging of differently-cased/-spelled values. Every existing row is
-- repointed at its own matching new row via a plain string-equality
-- join, and only then are the old free-text columns dropped.

-- CreateTable
CREATE TABLE "ticketing"."ticket_categories" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ticket_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_categories_branch_id_name_key" ON "ticketing"."ticket_categories"("branch_id", "name");

-- AddForeignKey
ALTER TABLE "ticketing"."ticket_categories" ADD CONSTRAINT "ticket_categories_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "identity"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: add the new nullable *_id columns alongside the still-present
-- legacy free-text columns (both exist simultaneously during backfill).
ALTER TABLE "ticketing"."tickets" ADD COLUMN "category_id" TEXT;
ALTER TABLE "sla"."sla_policies" ADD COLUMN "category_id" TEXT;
ALTER TABLE "sla"."automation_rules" ADD COLUMN "condition_category_id" TEXT;
ALTER TABLE "sla"."automation_rules" ADD COLUMN "action_set_category_id" TEXT;

-- Backfill: one ticket_categories row per exact, distinct (branch_id, value)
-- pair across all four legacy free-text columns. UNION's own dedup collapses
-- the exact same string appearing in more than one source column/table for
-- the same branch; two differently-cased or -spelled strings never collapse,
-- by design — nothing here normalizes or merges data.
INSERT INTO "ticketing"."ticket_categories" ("id", "branch_id", "name", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid(), "distinct_values"."branch_id", "distinct_values"."value", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "branch_id", "category" AS "value" FROM "ticketing"."tickets" WHERE "category" IS NOT NULL
    UNION
    SELECT DISTINCT "branch_id", "category" AS "value" FROM "sla"."sla_policies" WHERE "category" IS NOT NULL
    UNION
    SELECT DISTINCT "branch_id", "condition_category" AS "value" FROM "sla"."automation_rules" WHERE "condition_category" IS NOT NULL
    UNION
    SELECT DISTINCT "branch_id", "action_set_category" AS "value" FROM "sla"."automation_rules" WHERE "action_set_category" IS NOT NULL
) AS "distinct_values"("branch_id", "value");

-- Repoint every existing row at its own matching new category row via a
-- plain string-equality join (same exact-match semantics the legacy
-- columns always had — this migration changes what type of value is
-- compared, from a string to a stable id, not the matching rule itself).
UPDATE "ticketing"."tickets" AS "t"
SET "category_id" = "tc"."id"
FROM "ticketing"."ticket_categories" AS "tc"
WHERE "t"."category" IS NOT NULL
  AND "tc"."branch_id" = "t"."branch_id"
  AND "tc"."name" = "t"."category";

UPDATE "sla"."sla_policies" AS "sp"
SET "category_id" = "tc"."id"
FROM "ticketing"."ticket_categories" AS "tc"
WHERE "sp"."category" IS NOT NULL
  AND "tc"."branch_id" = "sp"."branch_id"
  AND "tc"."name" = "sp"."category";

UPDATE "sla"."automation_rules" AS "ar"
SET "condition_category_id" = "tc"."id"
FROM "ticketing"."ticket_categories" AS "tc"
WHERE "ar"."condition_category" IS NOT NULL
  AND "tc"."branch_id" = "ar"."branch_id"
  AND "tc"."name" = "ar"."condition_category";

UPDATE "sla"."automation_rules" AS "ar"
SET "action_set_category_id" = "tc"."id"
FROM "ticketing"."ticket_categories" AS "tc"
WHERE "ar"."action_set_category" IS NOT NULL
  AND "tc"."branch_id" = "ar"."branch_id"
  AND "tc"."name" = "ar"."action_set_category";

-- Drop the legacy free-text columns only now that every row referencing a
-- non-null value has been confirmed repointed to a real ticket_categories row.
ALTER TABLE "ticketing"."tickets" DROP COLUMN "category";
ALTER TABLE "sla"."sla_policies" DROP COLUMN "category";
ALTER TABLE "sla"."automation_rules" DROP COLUMN "condition_category";
ALTER TABLE "sla"."automation_rules" DROP COLUMN "action_set_category";

-- CreateIndex
CREATE INDEX "tickets_category_id_idx" ON "ticketing"."tickets"("category_id");
CREATE INDEX "sla_policies_category_id_idx" ON "sla"."sla_policies"("category_id");
CREATE INDEX "automation_rules_condition_category_id_idx" ON "sla"."automation_rules"("condition_category_id");
CREATE INDEX "automation_rules_action_set_category_id_idx" ON "sla"."automation_rules"("action_set_category_id");

-- AddForeignKey
ALTER TABLE "ticketing"."tickets" ADD CONSTRAINT "tickets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticketing"."ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sla"."sla_policies" ADD CONSTRAINT "sla_policies_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "ticketing"."ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sla"."automation_rules" ADD CONSTRAINT "automation_rules_condition_category_id_fkey" FOREIGN KEY ("condition_category_id") REFERENCES "ticketing"."ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sla"."automation_rules" ADD CONSTRAINT "automation_rules_action_set_category_id_fkey" FOREIGN KEY ("action_set_category_id") REFERENCES "ticketing"."ticket_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
