-- CreateTable
CREATE TABLE "sla"."sla_escalations" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_at" TIMESTAMP(3) NOT NULL,
    "escalated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sla_escalations_ticket_id_target_type_target_at_key" ON "sla"."sla_escalations"("ticket_id", "target_type", "target_at");

-- AddForeignKey
ALTER TABLE "sla"."sla_escalations" ADD CONSTRAINT "sla_escalations_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticketing"."tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
