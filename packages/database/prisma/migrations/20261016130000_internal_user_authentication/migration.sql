CREATE TYPE "InternalUserStatus" AS ENUM ('PENDING_ENROLLMENT', 'ACTIVE', 'RECOVERY_REQUIRED', 'DISABLED');
CREATE TYPE "InternalChallengePurpose" AS ENUM ('LOGIN', 'ENROLLMENT', 'RECOVERY');
CREATE TYPE "InternalAuditActorType" AS ENUM ('OPERATOR', 'INTERNAL_USER', 'SYSTEM');

CREATE TABLE "internal_users" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "emailNormalized" TEXT NOT NULL,
  "passwordHash" TEXT,
  "status" "InternalUserStatus" NOT NULL DEFAULT 'PENDING_ENROLLMENT',
  "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "totpSecretCiphertext" TEXT,
  "totpSecretIv" TEXT,
  "totpSecretAuthTag" TEXT,
  "lastAcceptedTotpStep" BIGINT NOT NULL DEFAULT -1,
  "setupTokenHash" TEXT,
  "setupTokenExpiresAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "internal_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "internal_users_email_normalized_key" ON "internal_users"("emailNormalized");
CREATE UNIQUE INDEX "internal_users_setup_token_hash_key" ON "internal_users"("setupTokenHash");
CREATE INDEX "internal_users_status_created_idx" ON "internal_users"("status", "createdAt");

CREATE TABLE "internal_sessions" (
  "id" UUID NOT NULL,
  "internalUserId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActivityAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "revokedAt" TIMESTAMPTZ(6),
  CONSTRAINT "internal_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "internal_sessions_internalUserId_fkey" FOREIGN KEY ("internalUserId") REFERENCES "internal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "internal_sessions_token_hash_key" ON "internal_sessions"("tokenHash");
CREATE INDEX "internal_sessions_user_active_idx" ON "internal_sessions"("internalUserId", "revokedAt", "expiresAt");
CREATE INDEX "internal_sessions_expiry_idx" ON "internal_sessions"("expiresAt");

CREATE TABLE "internal_auth_challenges" (
  "id" UUID NOT NULL,
  "internalUserId" UUID NOT NULL,
  "purpose" "InternalChallengePurpose" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "consumedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "internal_auth_challenges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "internal_auth_challenges_internalUserId_fkey" FOREIGN KEY ("internalUserId") REFERENCES "internal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "internal_auth_challenges_token_hash_key" ON "internal_auth_challenges"("tokenHash");
CREATE INDEX "internal_auth_challenges_user_purpose_expiry_idx" ON "internal_auth_challenges"("internalUserId", "purpose", "expiresAt");
CREATE INDEX "internal_auth_challenges_expiry_idx" ON "internal_auth_challenges"("expiresAt");

CREATE TABLE "internal_recovery_codes" (
  "id" UUID NOT NULL,
  "internalUserId" UUID NOT NULL,
  "codeHash" TEXT NOT NULL,
  "consumedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "internal_recovery_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "internal_recovery_codes_internalUserId_fkey" FOREIGN KEY ("internalUserId") REFERENCES "internal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "internal_recovery_codes_code_hash_key" ON "internal_recovery_codes"("codeHash");
CREATE INDEX "internal_recovery_codes_user_consumed_idx" ON "internal_recovery_codes"("internalUserId", "consumedAt");

CREATE TABLE "internal_audit_events" (
  "id" UUID NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorType" "InternalAuditActorType" NOT NULL,
  "actorId" UUID,
  "internalUserId" UUID,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "internal_audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "internal_audit_events_internalUserId_fkey" FOREIGN KEY ("internalUserId") REFERENCES "internal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "internal_audit_events_user_created_idx" ON "internal_audit_events"("internalUserId", "createdAt");
CREATE INDEX "internal_audit_events_type_created_idx" ON "internal_audit_events"("eventType", "createdAt");
