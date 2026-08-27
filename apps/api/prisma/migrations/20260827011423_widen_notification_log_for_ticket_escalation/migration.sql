-- AlterTable
ALTER TABLE "notifications"."notification_logs" ADD COLUMN     "dedupe_key" TEXT,
ALTER COLUMN "branch_id" DROP NOT NULL,
ALTER COLUMN "target_type" DROP NOT NULL,
ALTER COLUMN "target_at" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "notification_logs_event_type_dedupe_key_key" ON "notifications"."notification_logs"("event_type", "dedupe_key");
