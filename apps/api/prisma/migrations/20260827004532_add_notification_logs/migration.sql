-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "notifications";

-- CreateTable
CREATE TABLE "notifications"."notification_logs" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_at" TIMESTAMP(3) NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_logs_event_type_ticket_id_target_type_target_a_key" ON "notifications"."notification_logs"("event_type", "ticket_id", "target_type", "target_at");

-- AddForeignKey
ALTER TABLE "notifications"."notification_logs" ADD CONSTRAINT "notification_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticketing"."tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
