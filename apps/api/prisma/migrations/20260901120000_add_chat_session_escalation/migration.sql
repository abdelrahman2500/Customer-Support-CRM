-- AlterEnum
ALTER TYPE "channels"."ChannelType" ADD VALUE 'AI_CHAT';

-- AlterTable
ALTER TABLE "ai"."chat_sessions" ADD COLUMN     "escalated_ticket_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "chat_sessions_escalated_ticket_id_key" ON "ai"."chat_sessions"("escalated_ticket_id");

-- AddForeignKey
ALTER TABLE "ai"."chat_sessions" ADD CONSTRAINT "chat_sessions_escalated_ticket_id_fkey" FOREIGN KEY ("escalated_ticket_id") REFERENCES "ticketing"."tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
