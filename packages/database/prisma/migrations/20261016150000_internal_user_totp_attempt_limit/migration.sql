ALTER TABLE "internal_users"
ADD COLUMN "totpFailureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "totpAuthenticatorDisabledAt" TIMESTAMPTZ(6);

ALTER TABLE "internal_users"
ADD CONSTRAINT "internal_users_totp_failure_count_check"
CHECK ("totpFailureCount" >= 0 AND "totpFailureCount" <= 100);
