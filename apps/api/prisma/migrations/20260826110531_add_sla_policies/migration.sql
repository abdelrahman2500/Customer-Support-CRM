-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "sla";

-- CreateTable
CREATE TABLE "sla"."sla_policies" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "department_id" TEXT,
    "category" TEXT,
    "priority" TEXT,
    "response_target_minutes" INTEGER NOT NULL,
    "resolution_target_minutes" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sla_policies_branch_id_idx" ON "sla"."sla_policies"("branch_id");

-- AddForeignKey
ALTER TABLE "sla"."sla_policies" ADD CONSTRAINT "sla_policies_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "identity"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla"."sla_policies" ADD CONSTRAINT "sla_policies_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "identity"."departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
