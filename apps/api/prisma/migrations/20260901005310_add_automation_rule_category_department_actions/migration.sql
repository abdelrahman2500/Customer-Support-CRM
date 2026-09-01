-- AlterTable
ALTER TABLE "sla"."automation_rules" ADD COLUMN     "action_set_category" TEXT,
ADD COLUMN     "action_set_department_id" TEXT;

-- AddForeignKey
ALTER TABLE "sla"."automation_rules" ADD CONSTRAINT "automation_rules_action_set_department_id_fkey" FOREIGN KEY ("action_set_department_id") REFERENCES "identity"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
