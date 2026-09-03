-- AlterTable
ALTER TABLE "identity"."refresh_tokens" ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "session_created_at" TIMESTAMP(3),
ADD COLUMN     "session_id" TEXT,
ADD COLUMN     "user_agent" TEXT;

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "identity"."refresh_tokens"("session_id");
