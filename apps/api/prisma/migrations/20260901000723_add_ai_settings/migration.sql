-- CreateTable
CREATE TABLE "ai"."ai_settings" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "summarize_enabled" BOOLEAN NOT NULL DEFAULT true,
    "suggest_reply_enabled" BOOLEAN NOT NULL DEFAULT true,
    "categorize_enabled" BOOLEAN NOT NULL DEFAULT true,
    "chat_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_settings_branch_id_key" ON "ai"."ai_settings"("branch_id");

-- AddForeignKey
ALTER TABLE "ai"."ai_settings" ADD CONSTRAINT "ai_settings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "identity"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
