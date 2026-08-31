-- AlterTable
ALTER TABLE "ai"."ai_prompt_logs" ADD COLUMN     "output_text" TEXT,
ADD COLUMN     "ticket_id" TEXT;

-- CreateIndex
CREATE INDEX "ai_prompt_logs_ticket_id_idx" ON "ai"."ai_prompt_logs"("ticket_id");

-- AddForeignKey
ALTER TABLE "ai"."ai_prompt_logs" ADD CONSTRAINT "ai_prompt_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticketing"."tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
