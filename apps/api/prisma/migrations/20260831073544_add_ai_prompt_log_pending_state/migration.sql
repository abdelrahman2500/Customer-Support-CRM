-- AlterEnum
ALTER TYPE "ai"."AiOutcome" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "ai"."ai_prompt_logs" ALTER COLUMN "latency_ms" DROP NOT NULL;
