-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ai";

-- CreateEnum
CREATE TYPE "ai"."AiFeature" AS ENUM ('SUMMARIZE', 'SUGGEST_REPLY', 'CATEGORIZE', 'CHAT');

-- CreateEnum
CREATE TYPE "ai"."AiOutcome" AS ENUM ('SUCCESS', 'ERROR', 'DISABLED');

-- CreateTable
CREATE TABLE "ai"."ai_prompt_logs" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "feature" "ai"."AiFeature" NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_ref" TEXT NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "latency_ms" INTEGER NOT NULL,
    "outcome" "ai"."AiOutcome" NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_prompt_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_prompt_logs_branch_id_idx" ON "ai"."ai_prompt_logs"("branch_id");

-- CreateIndex
CREATE INDEX "ai_prompt_logs_feature_idx" ON "ai"."ai_prompt_logs"("feature");

-- AddForeignKey
ALTER TABLE "ai"."ai_prompt_logs" ADD CONSTRAINT "ai_prompt_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "identity"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
