-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "channels";

-- CreateEnum
CREATE TYPE "channels"."ChannelType" AS ENUM ('EMAIL', 'WHATSAPP', 'SMS', 'LIVE_CHAT', 'WEB_FORM');

-- CreateEnum
CREATE TYPE "channels"."ChannelMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateTable
CREATE TABLE "channels"."channel_messages" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "channel_type" "channels"."ChannelType" NOT NULL,
    "direction" "channels"."ChannelMessageDirection" NOT NULL,
    "external_thread_id" TEXT,
    "sender_contact_id" TEXT,
    "sender_user_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_messages_ticket_id_idx" ON "channels"."channel_messages"("ticket_id");

-- AddForeignKey
ALTER TABLE "channels"."channel_messages" ADD CONSTRAINT "channel_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticketing"."tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels"."channel_messages" ADD CONSTRAINT "channel_messages_sender_contact_id_fkey" FOREIGN KEY ("sender_contact_id") REFERENCES "customers"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels"."channel_messages" ADD CONSTRAINT "channel_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "identity"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
