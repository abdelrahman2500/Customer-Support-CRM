-- CreateTable
CREATE TABLE "admin"."branding_configs" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "logo_url" TEXT,
    "primary_color" TEXT,
    "secondary_color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branding_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branding_configs_branch_id_key" ON "admin"."branding_configs"("branch_id");

-- AddForeignKey
ALTER TABLE "admin"."branding_configs" ADD CONSTRAINT "branding_configs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "identity"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
