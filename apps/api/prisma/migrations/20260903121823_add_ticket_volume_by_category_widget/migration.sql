-- Story 126 — Ticket Volume by Category. New report widget type only; the
-- accompanying DropIndex/AlterTable Prisma proposed alongside this (on
-- knowledge_base_articles.search_vector) is pre-existing schema drift from
-- that column's Unsupported("tsvector") generated-column type (Story 102 —
-- Prisma cannot fully express a STORED generated column, so its diff
-- engine sees drift against the live DB on every migration from here on).
-- Deliberately excluded — unrelated to this Story, see CLAUDE.md §4.

-- AlterEnum
ALTER TYPE "reporting"."ReportWidgetType" ADD VALUE 'TICKET_VOLUME_BY_CATEGORY';
