-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "customers";

-- CreateTable
CREATE TABLE "customers"."customers" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers"."contacts" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_branch_id_idx" ON "customers"."customers"("branch_id");

-- CreateIndex
CREATE INDEX "contacts_customer_id_idx" ON "customers"."contacts"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_customer_id_email_key" ON "customers"."contacts"("customer_id", "email");

-- AddForeignKey
ALTER TABLE "customers"."customers" ADD CONSTRAINT "customers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "identity"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers"."contacts" ADD CONSTRAINT "contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
