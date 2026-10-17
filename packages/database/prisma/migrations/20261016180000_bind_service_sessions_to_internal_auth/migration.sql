ALTER TABLE "service_sessions"
ADD COLUMN "internalSessionId" UUID;

UPDATE "service_sessions"
SET "endedAt" = CURRENT_TIMESTAMP,
    "endReason" = 'reauthentication_required'
WHERE "endedAt" IS NULL;

INSERT INTO "audit_events" (
  "eventType", "actorType", "serviceSessionId", "companyId", "venueId",
  "entityType", "entityId", "metadata"
)
SELECT
  'service_access.ended', 'SYSTEM', session."id", access_grant."companyId", access_grant."venueId",
  'SUPPORT_ACCESS_GRANT', access_grant."id",
  jsonb_build_object(
    'reason', 'reauthentication_required',
    'internalUserId', session."internalUserId",
    'serviceSessionId', session."id"
  )
FROM "service_sessions" AS session
JOIN "support_access_grants" AS access_grant ON access_grant."id" = session."grantId"
WHERE session."endReason" = 'reauthentication_required';

INSERT INTO "internal_audit_events" (
  "id", "eventType", "actorType", "companyId", "venueId", "serviceSessionId", "metadata"
)
SELECT
  gen_random_uuid(), 'service_access.ended', 'SYSTEM', access_grant."companyId", access_grant."venueId", session."id",
  jsonb_build_object(
    'grantId', access_grant."id",
    'serviceSessionId', session."id",
    'internalUserId', session."internalUserId",
    'reason', 'reauthentication_required'
  )
FROM "service_sessions" AS session
JOIN "support_access_grants" AS access_grant ON access_grant."id" = session."grantId"
WHERE session."endReason" = 'reauthentication_required';

ALTER TABLE "service_sessions"
ADD CONSTRAINT "service_sessions_internalSessionId_fkey"
FOREIGN KEY ("internalSessionId") REFERENCES "internal_sessions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_sessions"
ADD CONSTRAINT "service_sessions_active_auth_session_check"
CHECK ("endedAt" IS NOT NULL OR "internalSessionId" IS NOT NULL);

CREATE INDEX "service_sessions_internal_session_active_idx"
ON "service_sessions"("internalSessionId", "endedAt");
