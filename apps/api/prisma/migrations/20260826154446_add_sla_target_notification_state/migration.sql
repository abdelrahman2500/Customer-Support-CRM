-- AlterTable
ALTER TABLE "sla"."sla_ticket_targets" ADD COLUMN     "resolution_at_risk_notified_at" TIMESTAMP(3),
ADD COLUMN     "resolution_breached_notified_at" TIMESTAMP(3),
ADD COLUMN     "response_at_risk_notified_at" TIMESTAMP(3),
ADD COLUMN     "response_breached_notified_at" TIMESTAMP(3);
