CREATE TYPE "ChallengePurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');
CREATE TYPE "CompanyRole" AS ENUM ('CHEF_BARTENDER');
CREATE TYPE "VenueRole" AS ENUM ('BAR_MANAGER');
CREATE TYPE "VenueStatus" AS ENUM ('ACTIVE');

CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users"("emailNormalized");

CREATE TABLE "user_profiles" (
    "userId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "registration_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyNameNormalized" TEXT NOT NULL,
    "venueName" TEXT NOT NULL,
    "venueNameNormalized" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "registration_attempts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "registration_attempts_token_hash_key" ON "registration_attempts"("tokenHash");
CREATE UNIQUE INDEX "registration_attempts_email_normalized_key" ON "registration_attempts"("emailNormalized");
CREATE INDEX "registration_attempts_email_expiry_idx" ON "registration_attempts"("emailNormalized", "expiresAt");
CREATE INDEX "registration_attempts_expiry_idx" ON "registration_attempts"("expiresAt");

CREATE TABLE "email_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "emailNormalized" TEXT NOT NULL,
    "purpose" "ChallengePurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "consumedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" UUID,
    "registrationAttemptId" UUID,
    CONSTRAINT "email_challenges_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "email_challenges_target_check" CHECK (
      ("purpose" = 'EMAIL_VERIFICATION' AND "userId" IS NULL AND "registrationAttemptId" IS NOT NULL)
      OR ("purpose" = 'PASSWORD_RESET' AND "userId" IS NOT NULL AND "registrationAttemptId" IS NULL)
    )
);
CREATE INDEX "email_challenges_lookup_idx" ON "email_challenges"("emailNormalized", "purpose", "expiresAt");
CREATE UNIQUE INDEX "email_challenges_one_open_per_target_key"
    ON "email_challenges"("emailNormalized", "purpose") WHERE "consumedAt" IS NULL;
ALTER TABLE "email_challenges" ADD CONSTRAINT "email_challenges_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_challenges" ADD CONSTRAINT "email_challenges_registrationAttemptId_fkey"
    FOREIGN KEY ("registrationAttemptId") REFERENCES "registration_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("tokenHash");
CREATE INDEX "sessions_user_active_idx" ON "sessions"("userId", "revokedAt", "expiresAt");
CREATE INDEX "sessions_expiry_idx" ON "sessions"("expiresAt");
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "outbox_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventType" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "payloadCiphertext" TEXT,
    "payloadIv" TEXT,
    "payloadAuthTag" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMPTZ(6),
    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "outbox_payload_all_or_none_check" CHECK (
      ("payloadCiphertext" IS NULL AND "payloadIv" IS NULL AND "payloadAuthTag" IS NULL)
      OR ("payloadCiphertext" IS NOT NULL AND "payloadIv" IS NOT NULL AND "payloadAuthTag" IS NOT NULL)
    )
);
CREATE INDEX "outbox_messages_pending_idx" ON "outbox_messages"("status", "nextAttemptAt");

CREATE TABLE "companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "venues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "status" "VenueStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "venues_id_company_id_key" ON "venues"("id", "companyId");
CREATE UNIQUE INDEX "venues_company_normalized_name_key" ON "venues"("companyId", "nameNormalized");
CREATE INDEX "venues_company_id_idx" ON "venues"("companyId");
ALTER TABLE "venues" ADD CONSTRAINT "venues_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "company_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "companyRole" "CompanyRole",
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "company_memberships_user_company_key" ON "company_memberships"("userId", "companyId");
CREATE INDEX "company_memberships_company_id_idx" ON "company_memberships"("companyId");
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_memberships" ADD CONSTRAINT "company_memberships_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "venue_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "venueId" UUID NOT NULL,
    "role" "VenueRole" NOT NULL DEFAULT 'BAR_MANAGER',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "venue_memberships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "venue_memberships_user_venue_key" ON "venue_memberships"("userId", "venueId");
CREATE INDEX "venue_memberships_company_venue_idx" ON "venue_memberships"("companyId", "venueId");
ALTER TABLE "venue_memberships" ADD CONSTRAINT "venue_memberships_venueId_companyId_fkey"
    FOREIGN KEY ("venueId", "companyId") REFERENCES "venues"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "venue_memberships" ADD CONSTRAINT "venue_memberships_userId_companyId_fkey"
    FOREIGN KEY ("userId", "companyId") REFERENCES "company_memberships"("userId", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "venue_memberships" ADD CONSTRAINT "venue_memberships_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
