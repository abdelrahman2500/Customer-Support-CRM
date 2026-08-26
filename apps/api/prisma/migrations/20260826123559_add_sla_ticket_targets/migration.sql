-- CreateTable
CREATE TABLE "sla"."sla_ticket_targets" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "sla_policy_id" TEXT NOT NULL,
    "response_target_at" TIMESTAMP(3) NOT NULL,
    "resolution_target_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_ticket_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sla_ticket_targets_ticket_id_key" ON "sla"."sla_ticket_targets"("ticket_id");

-- AddForeignKey
ALTER TABLE "sla"."sla_ticket_targets" ADD CONSTRAINT "sla_ticket_targets_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticketing"."tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla"."sla_ticket_targets" ADD CONSTRAINT "sla_ticket_targets_sla_policy_id_fkey" FOREIGN KEY ("sla_policy_id") REFERENCES "sla"."sla_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
