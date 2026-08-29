-- AlterTable
ALTER TABLE "customers"."contacts" ADD COLUMN     "password_hash" TEXT;

-- CreateTable
CREATE TABLE "customers"."contact_refresh_tokens" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contact_refresh_tokens_token_hash_key" ON "customers"."contact_refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "contact_refresh_tokens_contact_id_idx" ON "customers"."contact_refresh_tokens"("contact_id");

-- AddForeignKey
ALTER TABLE "customers"."contact_refresh_tokens" ADD CONSTRAINT "contact_refresh_tokens_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "customers"."contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
