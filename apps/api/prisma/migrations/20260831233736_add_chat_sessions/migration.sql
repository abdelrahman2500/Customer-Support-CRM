-- CreateEnum
CREATE TYPE "ai"."ChatMessageRole" AS ENUM ('CUSTOMER', 'ASSISTANT');

-- AlterTable
ALTER TABLE "ai"."ai_prompt_logs" ADD COLUMN     "chat_session_id" TEXT;

-- CreateTable
CREATE TABLE "ai"."chat_sessions" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai"."chat_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" "ai"."ChatMessageRole" NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_sessions_branch_id_idx" ON "ai"."chat_sessions"("branch_id");

-- CreateIndex
CREATE INDEX "chat_sessions_contact_id_idx" ON "ai"."chat_sessions"("contact_id");

-- CreateIndex
CREATE INDEX "chat_messages_session_id_idx" ON "ai"."chat_messages"("session_id");

-- CreateIndex
CREATE INDEX "ai_prompt_logs_chat_session_id_idx" ON "ai"."ai_prompt_logs"("chat_session_id");

-- AddForeignKey
ALTER TABLE "ai"."ai_prompt_logs" ADD CONSTRAINT "ai_prompt_logs_chat_session_id_fkey" FOREIGN KEY ("chat_session_id") REFERENCES "ai"."chat_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."chat_sessions" ADD CONSTRAINT "chat_sessions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "identity"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."chat_sessions" ADD CONSTRAINT "chat_sessions_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "customers"."contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai"."chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai"."chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
