-- CreateTable
CREATE TABLE "ticketing"."ticket_csat_responses" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "submitted_by_contact_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_csat_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_csat_responses_ticket_id_key" ON "ticketing"."ticket_csat_responses"("ticket_id");

-- AddForeignKey
ALTER TABLE "ticketing"."ticket_csat_responses" ADD CONSTRAINT "ticket_csat_responses_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticketing"."tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketing"."ticket_csat_responses" ADD CONSTRAINT "ticket_csat_responses_submitted_by_contact_id_fkey" FOREIGN KEY ("submitted_by_contact_id") REFERENCES "customers"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
