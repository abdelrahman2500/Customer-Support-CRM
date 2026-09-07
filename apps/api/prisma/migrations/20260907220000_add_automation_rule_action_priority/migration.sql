-- RM-29 — Automation Rules: auto-set priority action
--
-- Deliberately a plain nullable TEXT, not the ticketing.TicketPriority
-- enum (which lives in a different Postgres schema) — mirrors
-- sla.sla_policies.priority's own precedent exactly.

-- AlterTable
ALTER TABLE "sla"."automation_rules" ADD COLUMN "action_set_priority" TEXT;
