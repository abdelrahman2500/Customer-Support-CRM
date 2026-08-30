-- CreateEnum
CREATE TYPE "identity"."TicketVisibilityScope" AS ENUM ('BRANCH', 'DEPARTMENT');

-- AlterTable
ALTER TABLE "identity"."roles" ADD COLUMN     "ticket_visibility_scope" "identity"."TicketVisibilityScope" NOT NULL DEFAULT 'BRANCH';
