-- CreateTable
CREATE TABLE "customers"."customer_attachments" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploaded_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_attachments_key_key" ON "customers"."customer_attachments"("key");

-- CreateIndex
CREATE INDEX "customer_attachments_customer_id_idx" ON "customers"."customer_attachments"("customer_id");

-- AddForeignKey
ALTER TABLE "customers"."customer_attachments" ADD CONSTRAINT "customer_attachments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers"."customer_attachments" ADD CONSTRAINT "customer_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
