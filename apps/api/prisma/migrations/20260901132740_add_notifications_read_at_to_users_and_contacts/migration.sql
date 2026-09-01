-- AlterTable
ALTER TABLE "customers"."contacts" ADD COLUMN     "notifications_read_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "identity"."users" ADD COLUMN     "notifications_read_at" TIMESTAMP(3);
