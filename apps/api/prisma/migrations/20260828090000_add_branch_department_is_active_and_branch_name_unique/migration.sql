-- AlterTable
ALTER TABLE "identity"."branches" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "identity"."departments" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "branches_organization_id_name_key" ON "identity"."branches"("organization_id", "name");
