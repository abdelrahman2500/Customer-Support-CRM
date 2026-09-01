-- AlterTable
ALTER TABLE "notifications"."notification_logs" ADD COLUMN     "customer_id" TEXT;

-- AddForeignKey
ALTER TABLE "notifications"."notification_logs" ADD CONSTRAINT "notification_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
