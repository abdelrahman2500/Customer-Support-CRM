-- CreateTable
CREATE TABLE "notifications"."portal_notification_preferences" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portal_notification_preferences_contact_id_event_type_key" ON "notifications"."portal_notification_preferences"("contact_id", "event_type");

-- AddForeignKey
ALTER TABLE "notifications"."portal_notification_preferences" ADD CONSTRAINT "portal_notification_preferences_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "customers"."contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
