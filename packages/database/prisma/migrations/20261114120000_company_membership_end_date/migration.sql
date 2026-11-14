ALTER TABLE "company_memberships"
ADD COLUMN "endedOn" DATE;

WITH "latestCompanyExit" AS (
  SELECT
    "entityId" AS "membershipId",
    MAX(COALESCE(NULLIF("metadata" ->> 'terminationDate', '')::DATE, "createdAt"::DATE)) AS "endedOn"
  FROM "audit_events"
  WHERE "eventType" = 'company_membership.ended'
    AND "entityType" = 'company_membership'
  GROUP BY "entityId"
)
UPDATE "company_memberships" AS membership
SET "endedOn" = latest."endedOn"
FROM "latestCompanyExit" AS latest
WHERE membership."id" = latest."membershipId"
  AND membership."companyRole" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "venue_memberships" AS venueMembership
    WHERE venueMembership."userId" = membership."userId"
      AND venueMembership."companyId" = membership."companyId"
      AND (venueMembership."endedOn" IS NULL OR venueMembership."endedOn" > CURRENT_DATE)
  );
