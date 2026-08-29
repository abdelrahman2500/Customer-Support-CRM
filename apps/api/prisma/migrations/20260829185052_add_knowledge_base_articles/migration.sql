-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "knowledge_base";

-- CreateEnum
CREATE TYPE "knowledge_base"."KnowledgeBaseArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "knowledge_base"."knowledge_base_articles" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT,
    "status" "knowledge_base"."KnowledgeBaseArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_base_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_base_articles_branch_id_idx" ON "knowledge_base"."knowledge_base_articles"("branch_id");

-- AddForeignKey
ALTER TABLE "knowledge_base"."knowledge_base_articles" ADD CONSTRAINT "knowledge_base_articles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "identity"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
