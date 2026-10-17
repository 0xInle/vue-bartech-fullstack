ALTER TYPE "AuditActorType" ADD VALUE 'INTERNAL_USER';

ALTER TABLE "audit_events"
  ADD COLUMN "internalUserId" UUID,
  ADD COLUMN "serviceSessionId" UUID;

ALTER TABLE "internal_audit_events"
  ADD COLUMN "companyId" UUID,
  ADD COLUMN "venueId" UUID,
  ADD COLUMN "serviceSessionId" UUID;

CREATE TYPE "SupportAccessScopeType" AS ENUM ('COMPANY', 'VENUE');

CREATE TABLE "support_access_grants" (
  "id" UUID NOT NULL,
  "authorUserId" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "venueId" UUID,
  "scopeType" "SupportAccessScopeType" NOT NULL,
  "requestId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "revokedAt" TIMESTAMPTZ(6),
  "revokedByUserId" UUID,
  "revocationReason" TEXT,
  CONSTRAINT "support_access_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_access_grants_scope_check" CHECK (
    ("scopeType" = 'COMPANY' AND "venueId" IS NULL) OR
    ("scopeType" = 'VENUE' AND "venueId" IS NOT NULL)
  ),
  CONSTRAINT "support_access_grants_expiry_check" CHECK (
    "expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + INTERVAL '7 days'
  ),
  CONSTRAINT "support_access_grants_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_access_grants_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "support_access_grants_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_access_grants_venueId_companyId_fkey" FOREIGN KEY ("venueId", "companyId") REFERENCES "venues"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_access_grants_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "support_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "service_sessions" (
  "id" UUID NOT NULL,
  "grantId" UUID NOT NULL,
  "internalUserId" UUID NOT NULL,
  "startedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "endedAt" TIMESTAMPTZ(6),
  "endReason" TEXT,
  CONSTRAINT "service_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_sessions_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "support_access_grants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "service_sessions_internalUserId_fkey" FOREIGN KEY ("internalUserId") REFERENCES "internal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "service_sessions_expiry_check" CHECK ("expiresAt" > "startedAt")
);

ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_internalUserId_fkey" FOREIGN KEY ("internalUserId") REFERENCES "internal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "audit_events_serviceSessionId_fkey" FOREIGN KEY ("serviceSessionId") REFERENCES "service_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "internal_audit_events"
  ADD CONSTRAINT "internal_audit_events_serviceSessionId_fkey" FOREIGN KEY ("serviceSessionId") REFERENCES "service_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "support_access_grants_scope_active_idx" ON "support_access_grants"("companyId", "scopeType", "venueId", "revokedAt", "expiresAt");
CREATE INDEX "support_access_grants_author_created_idx" ON "support_access_grants"("authorUserId", "createdAt");
CREATE INDEX "support_access_grants_request_idx" ON "support_access_grants"("requestId");
CREATE INDEX "service_sessions_grant_active_idx" ON "service_sessions"("grantId", "endedAt", "expiresAt");
CREATE INDEX "service_sessions_user_active_idx" ON "service_sessions"("internalUserId", "endedAt", "expiresAt");
CREATE INDEX "audit_events_internal_user_created_idx" ON "audit_events"("internalUserId", "createdAt");
CREATE INDEX "internal_audit_events_company_created_idx" ON "internal_audit_events"("companyId", "createdAt");

UPDATE "internal_users"
SET "permissions" = CASE
  WHEN 'customer_content_access' = ANY("permissions") AND NOT ('service_access' = ANY("permissions"))
    THEN array_append(array_remove("permissions", 'customer_content_access'), 'service_access')
  ELSE array_remove("permissions", 'customer_content_access')
END;
