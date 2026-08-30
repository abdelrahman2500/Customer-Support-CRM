-- CreateTable
CREATE TABLE "notifications"."notification_templates" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_branch_id_event_type_key" ON "notifications"."notification_templates"("branch_id", "event_type");

-- AddForeignKey
ALTER TABLE "notifications"."notification_templates" ADD CONSTRAINT "notification_templates_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "identity"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
