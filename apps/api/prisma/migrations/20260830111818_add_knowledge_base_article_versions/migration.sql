-- CreateTable
CREATE TABLE "knowledge_base"."knowledge_base_article_versions" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_base_article_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_base_article_versions_article_id_idx" ON "knowledge_base"."knowledge_base_article_versions"("article_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_base_article_versions_article_id_version_number_key" ON "knowledge_base"."knowledge_base_article_versions"("article_id", "version_number");

-- AddForeignKey
ALTER TABLE "knowledge_base"."knowledge_base_article_versions" ADD CONSTRAINT "knowledge_base_article_versions_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "knowledge_base"."knowledge_base_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
