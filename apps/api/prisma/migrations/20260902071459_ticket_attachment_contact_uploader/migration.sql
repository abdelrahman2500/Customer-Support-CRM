-- Story 103 — a portal Contact can now also be an attachment's uploader,
-- mirroring ChannelMessage's existing senderContactId/senderUserId
-- nullable-pair shape.
--
-- Note: Prisma's own migration-diff engine additionally proposed dropping
-- Story 102's `knowledge_base_articles_search_vector_idx` GIN index and
-- the `search_vector` generated column's default — both are spurious,
-- caused by Prisma's shadow-database diff not understanding a raw-SQL
-- `GENERATED ALWAYS AS (...) STORED` column represented in the schema as
-- `Unsupported("tsvector")`. Deliberately NOT included here — doing so
-- would silently break Story 102's full-text search.

-- DropForeignKey
ALTER TABLE "customers"."ticket_attachments" DROP CONSTRAINT "ticket_attachments_uploaded_by_user_id_fkey";

-- AlterTable
ALTER TABLE "customers"."ticket_attachments" ADD COLUMN     "uploaded_by_contact_id" TEXT,
ALTER COLUMN "uploaded_by_user_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "customers"."ticket_attachments" ADD CONSTRAINT "ticket_attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers"."ticket_attachments" ADD CONSTRAINT "ticket_attachments_uploaded_by_contact_id_fkey" FOREIGN KEY ("uploaded_by_contact_id") REFERENCES "customers"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
