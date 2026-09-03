-- Story 122 — Identity & Access: Account Lockout. Purely additive, zero
-- backfill: every existing user starts unlocked (0 failed attempts, no
-- lock), the exact state a never-failed-login user already implicitly has.

-- AlterTable
ALTER TABLE "identity"."users" ADD COLUMN     "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMP(3);
