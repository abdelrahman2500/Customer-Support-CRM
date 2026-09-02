-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "reporting";

-- CreateEnum
CREATE TYPE "reporting"."ReportWidgetType" AS ENUM ('TICKET_VOLUME', 'SLA_COMPLIANCE', 'CSAT', 'AGENT_PERFORMANCE', 'TICKET_AGING', 'RESOLUTION_TIME');

-- The two lines this section would otherwise contain (a spurious
-- DROP INDEX + ALTER COLUMN DROP DEFAULT on
-- "knowledge_base"."knowledge_base_articles"."search_vector") are
-- discarded: this is the same known false-positive Prisma's schema-diff
-- engine produces against Story 102's `Unsupported("tsvector")`
-- generated column every time, already documented and worked around in
-- Story 109's and Story 115's own migrations.

-- CreateTable
CREATE TABLE "reporting"."report_dashboards" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporting"."report_dashboard_widgets" (
    "id" TEXT NOT NULL,
    "dashboard_id" TEXT NOT NULL,
    "widget_type" "reporting"."ReportWidgetType" NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_dashboard_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_dashboards_branch_id_is_shared_idx" ON "reporting"."report_dashboards"("branch_id", "is_shared");

-- CreateIndex
CREATE INDEX "report_dashboards_owner_user_id_idx" ON "reporting"."report_dashboards"("owner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_dashboard_widgets_dashboard_id_position_key" ON "reporting"."report_dashboard_widgets"("dashboard_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "report_dashboard_widgets_dashboard_id_widget_type_key" ON "reporting"."report_dashboard_widgets"("dashboard_id", "widget_type");

-- AddForeignKey
ALTER TABLE "reporting"."report_dashboards" ADD CONSTRAINT "report_dashboards_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "identity"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporting"."report_dashboards" ADD CONSTRAINT "report_dashboards_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "identity"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporting"."report_dashboard_widgets" ADD CONSTRAINT "report_dashboard_widgets_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "reporting"."report_dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Story 110 — extends Story 115's `add_runtime_db_role_grants` to this
-- brand-new schema, which that migration could not have anticipated
-- (it didn't exist yet). Identical shape to that migration's other 9
-- schemas: ordinary CRUD for the restricted `crm_app` runtime role, plus
-- default privileges so any later migration's future tables in this
-- schema are automatically covered too. `admin.audit_logs`'s special
-- case is untouched — nothing here is append-only.
GRANT USAGE ON SCHEMA "reporting" TO crm_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "reporting" TO crm_app;
ALTER DEFAULT PRIVILEGES FOR ROLE crm IN SCHEMA "reporting"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crm_app;
