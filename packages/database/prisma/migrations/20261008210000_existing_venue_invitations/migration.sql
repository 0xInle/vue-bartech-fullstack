CREATE TYPE "InvitationStatus" AS ENUM ('ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'CLOSED');

ALTER TYPE "ChallengePurpose" ADD VALUE 'INVITATION_EMAIL_VERIFICATION';

CREATE TABLE "invitations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "companyId" UUID NOT NULL,
  "venueId" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "emailNormalized" TEXT NOT NULL,
  "role" "VenueRole" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdByUserId" UUID,
  "status" "InvitationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "completedAt" TIMESTAMPTZ(6),
  "closedAt" TIMESTAMPTZ(6),
  CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("tokenHash");
CREATE INDEX "invitations_venue_status_expiry_idx" ON "invitations"("venueId", "status", "expiresAt");
CREATE INDEX "invitations_email_venue_idx" ON "invitations"("emailNormalized", "venueId");
CREATE UNIQUE INDEX "invitations_one_open_per_email_venue_key"
  ON "invitations"("emailNormalized", "venueId")
  WHERE "status" IN ('ACTIVE', 'IN_PROGRESS');

ALTER TABLE "invitations" ADD CONSTRAINT "invitations_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_venueId_companyId_fkey"
  FOREIGN KEY ("venueId", "companyId") REFERENCES "venues"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "invitation_acceptance_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "invitationId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "emailNormalized" TEXT NOT NULL,
  "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "userId" UUID,
  "fullName" TEXT,
  "passwordHash" TEXT,
  "emailVerifiedAt" TIMESTAMPTZ(6),
  CONSTRAINT "invitation_acceptance_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invitation_acceptance_sessions_invitation_key"
  ON "invitation_acceptance_sessions"("invitationId");
CREATE UNIQUE INDEX "invitation_acceptance_sessions_token_hash_key"
  ON "invitation_acceptance_sessions"("tokenHash");
CREATE INDEX "invitation_acceptance_sessions_expiry_idx"
  ON "invitation_acceptance_sessions"("expiresAt");
ALTER TABLE "invitation_acceptance_sessions" ADD CONSTRAINT "invitation_acceptance_sessions_invitationId_fkey"
  FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitation_acceptance_sessions" ADD CONSTRAINT "invitation_acceptance_sessions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_challenges" ADD COLUMN "invitationSessionId" UUID;
ALTER TABLE "email_challenges" ADD CONSTRAINT "email_challenges_invitationSessionId_fkey"
  FOREIGN KEY ("invitationSessionId") REFERENCES "invitation_acceptance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "email_challenges_invitation_session_idx"
  ON "email_challenges"("invitationSessionId", "purpose", "expiresAt");

CREATE TYPE "AuditActorType" AS ENUM ('USER', 'SYSTEM');

CREATE TABLE "audit_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "eventType" TEXT NOT NULL,
  "actorType" "AuditActorType" NOT NULL,
  "actorId" UUID,
  "companyId" UUID,
  "venueId" UUID,
  "entityType" TEXT NOT NULL,
  "entityId" UUID NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_events_company_created_idx" ON "audit_events"("companyId", "createdAt");
CREATE INDEX "audit_events_venue_created_idx" ON "audit_events"("venueId", "createdAt");
CREATE INDEX "audit_events_entity_created_idx" ON "audit_events"("entityType", "entityId", "createdAt");
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
