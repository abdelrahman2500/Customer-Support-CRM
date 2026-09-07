-- RM-28 — Knowledge Base Article Attachments
--
-- Identical shape to customers.customer_attachments (agent-only upload,
-- uploaded_by_user_id required, never nullable). Brand-new table — no
-- data migration needed.

-- CreateTable
CREATE TABLE "knowledge_base"."knowledge_base_article_attachments" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploaded_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_base_article_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_base_article_attachments_key_key" ON "knowledge_base"."knowledge_base_article_attachments"("key");

-- CreateIndex
CREATE INDEX "knowledge_base_article_attachments_article_id_idx" ON "knowledge_base"."knowledge_base_article_attachments"("article_id");

-- AddForeignKey
ALTER TABLE "knowledge_base"."knowledge_base_article_attachments" ADD CONSTRAINT "knowledge_base_article_attachments_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "knowledge_base"."knowledge_base_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_base"."knowledge_base_article_attachments" ADD CONSTRAINT "knowledge_base_article_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "identity"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
