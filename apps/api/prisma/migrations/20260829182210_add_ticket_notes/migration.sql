-- CreateTable
CREATE TABLE "ticketing"."ticket_notes" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_notes_ticket_id_idx" ON "ticketing"."ticket_notes"("ticket_id");

-- AddForeignKey
ALTER TABLE "ticketing"."ticket_notes" ADD CONSTRAINT "ticket_notes_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticketing"."tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketing"."ticket_notes" ADD CONSTRAINT "ticket_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
