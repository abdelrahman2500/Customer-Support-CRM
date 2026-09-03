-- Story 121 — AI Usage/Cost Reporting.
--
-- Adds a nullable per-call cost column to ai_prompt_logs (computed once,
-- by apps/worker's AiProcessingProcessor, never backfilled for existing
-- rows — see AiPromptLog.costMicroUsd's own schema doc comment) and a
-- new AI_USAGE report widget type.

-- AlterEnum
ALTER TYPE "reporting"."ReportWidgetType" ADD VALUE 'AI_USAGE';

-- AlterTable
ALTER TABLE "ai"."ai_prompt_logs" ADD COLUMN     "cost_micro_usd" INTEGER;
