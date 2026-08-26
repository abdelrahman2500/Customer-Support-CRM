-- CreateTable
CREATE TABLE "ticketing"."ticket_history_entries" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "event_type" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_history_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_history_entries_ticket_id_idx" ON "ticketing"."ticket_history_entries"("ticket_id");

-- AddForeignKey
ALTER TABLE "ticketing"."ticket_history_entries" ADD CONSTRAINT "ticket_history_entries_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticketing"."tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketing"."ticket_history_entries" ADD CONSTRAINT "ticket_history_entries_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
