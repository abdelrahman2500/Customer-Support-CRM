-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "ticketing";

-- CreateEnum
CREATE TYPE "ticketing"."TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ticketing"."TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "ticketing"."tickets" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "department_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "assigned_to_user_id" TEXT,
    "subject" TEXT NOT NULL,
    "category" TEXT,
    "priority" "ticketing"."TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "ticketing"."TicketStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tickets_branch_id_idx" ON "ticketing"."tickets"("branch_id");

-- CreateIndex
CREATE INDEX "tickets_customer_id_idx" ON "ticketing"."tickets"("customer_id");

-- CreateIndex
CREATE INDEX "tickets_assigned_to_user_id_idx" ON "ticketing"."tickets"("assigned_to_user_id");

-- AddForeignKey
ALTER TABLE "ticketing"."tickets" ADD CONSTRAINT "tickets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "identity"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketing"."tickets" ADD CONSTRAINT "tickets_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "identity"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketing"."tickets" ADD CONSTRAINT "tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketing"."tickets" ADD CONSTRAINT "tickets_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "customers"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticketing"."tickets" ADD CONSTRAINT "tickets_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
