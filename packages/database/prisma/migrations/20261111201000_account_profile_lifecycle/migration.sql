CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'PENDING_DELETION', 'DELETED');

ALTER TABLE "users"
  ALTER COLUMN "passwordHash" DROP NOT NULL,
  ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "deletionRequestedAt" TIMESTAMPTZ(6),
  ADD COLUMN "deletionScheduledAt" TIMESTAMPTZ(6),
  ADD CONSTRAINT "users_deletion_state_check" CHECK (
    ("status" = 'ACTIVE' AND "deletionRequestedAt" IS NULL AND "deletionScheduledAt" IS NULL)
    OR ("status" = 'PENDING_DELETION' AND "deletionRequestedAt" IS NOT NULL AND "deletionScheduledAt" IS NOT NULL)
    OR "status" = 'DELETED'
  );

ALTER TABLE "email_challenges"
  ADD COLUMN "email" TEXT,
  DROP CONSTRAINT "email_challenges_target_check",
  ADD CONSTRAINT "email_challenges_target_check" CHECK (
    ("purpose" = 'EMAIL_VERIFICATION' AND "userId" IS NULL AND "registrationAttemptId" IS NOT NULL AND "invitationSessionId" IS NULL)
    OR ("purpose" = 'PASSWORD_RESET' AND "userId" IS NOT NULL AND "registrationAttemptId" IS NULL AND "invitationSessionId" IS NULL)
    OR ("purpose" = 'INVITATION_EMAIL_VERIFICATION' AND "userId" IS NULL AND "registrationAttemptId" IS NULL AND "invitationSessionId" IS NOT NULL)
    OR ("purpose" = 'EMAIL_CHANGE' AND "userId" IS NOT NULL AND "registrationAttemptId" IS NULL AND "invitationSessionId" IS NULL AND "email" IS NOT NULL)
  );

CREATE INDEX "users_pending_deletion_idx" ON "users"("status", "deletionScheduledAt");
