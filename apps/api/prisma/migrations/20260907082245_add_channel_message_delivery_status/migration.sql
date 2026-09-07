-- CreateEnum
CREATE TYPE "channels"."ChannelMessageDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED');

-- RM-13 — the diff engine also emitted a spurious DROP INDEX on
-- knowledge_base_articles_search_vector_idx and an ALTER COLUMN
-- search_vector DROP DEFAULT here. Both are unrelated to this migration's
-- actual change and Postgres rejects DROP DEFAULT on a generated column
-- outright — this is the same known false-positive Story 102's generated
-- column always triggers on any schema diff (see Story 109/115's own
-- migrations for the identical, repo-blessed workaround: strip the
-- spurious lines, leave the column/index exactly as Story 102 created
-- them). Both removed here.

-- AlterTable
ALTER TABLE "channels"."channel_messages" ADD COLUMN     "delivery_status" "channels"."ChannelMessageDeliveryStatus" NOT NULL DEFAULT 'DELIVERED',
ADD COLUMN     "external_message_id" TEXT,
ADD COLUMN     "failure_reason" TEXT,
ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 0;
