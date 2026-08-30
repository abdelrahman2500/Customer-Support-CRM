-- CreateTable
CREATE TABLE "sla"."automation_rules" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "condition_category" TEXT,
    "action_assign_to_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_rules_branch_id_idx" ON "sla"."automation_rules"("branch_id");

-- AddForeignKey
ALTER TABLE "sla"."automation_rules" ADD CONSTRAINT "automation_rules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "identity"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla"."automation_rules" ADD CONSTRAINT "automation_rules_action_assign_to_user_id_fkey" FOREIGN KEY ("action_assign_to_user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
