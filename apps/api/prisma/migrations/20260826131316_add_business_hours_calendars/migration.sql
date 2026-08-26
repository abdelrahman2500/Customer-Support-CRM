-- CreateTable
CREATE TABLE "sla"."business_hours_calendars" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_hours_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla"."business_hours_days" (
    "id" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "is_open" BOOLEAN NOT NULL DEFAULT false,
    "start_minute" INTEGER,
    "end_minute" INTEGER,

    CONSTRAINT "business_hours_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla"."business_hours_exceptions" (
    "id" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT true,
    "override_start_minute" INTEGER,
    "override_end_minute" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_hours_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_hours_calendars_branch_id_key" ON "sla"."business_hours_calendars"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_hours_days_calendar_id_weekday_key" ON "sla"."business_hours_days"("calendar_id", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "business_hours_exceptions_calendar_id_date_key" ON "sla"."business_hours_exceptions"("calendar_id", "date");

-- AddForeignKey
ALTER TABLE "sla"."business_hours_calendars" ADD CONSTRAINT "business_hours_calendars_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "identity"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla"."business_hours_days" ADD CONSTRAINT "business_hours_days_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "sla"."business_hours_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla"."business_hours_exceptions" ADD CONSTRAINT "business_hours_exceptions_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "sla"."business_hours_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
