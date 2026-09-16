-- Story 132 — Customer Data Anonymization / Right-to-Erasure.
--
-- Additive only: two nullable columns, no default, no data rewrite. `NULL`
-- means "never anonymized", which every existing row correctly is, so no
-- existing row changes meaning on upgrade.
--
-- Hand-written rather than generated: `prisma migrate dev` has twice on this
-- repository picked up unrelated pre-existing drift (a generated
-- `search_vector` column, an `eligible_agent_pool` default) and emitted
-- destructive statements alongside the intended change. Zero DROP, zero
-- ALTER of any existing column, constraint or referential action here.

ALTER TABLE "customers"."customers" ADD COLUMN "anonymized_at" TIMESTAMP(3);
ALTER TABLE "customers"."contacts" ADD COLUMN "anonymized_at" TIMESTAMP(3);
