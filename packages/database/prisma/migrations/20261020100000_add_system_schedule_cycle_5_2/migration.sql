INSERT INTO "schedule_templates" ("id", "name", "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid(), '5/2', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "schedule_templates"
  WHERE "isSystem" = true AND "name" = '5/2'
);

INSERT INTO "schedule_template_versions" (
  "id", "templateId", "version", "workDays", "offDays", "durationHours", "shiftType", "createdAt"
)
SELECT
  gen_random_uuid(),
  template."id",
  COALESCE((SELECT MAX(version."version") + 1 FROM "schedule_template_versions" version WHERE version."templateId" = template."id"), 1),
  5,
  2,
  12,
  'NORMAL',
  CURRENT_TIMESTAMP
FROM "schedule_templates" template
WHERE template."isSystem" = true
  AND template."name" = '5/2'
  AND NOT EXISTS (
    SELECT 1
    FROM "schedule_template_versions" version
    WHERE version."templateId" = template."id"
      AND version."workDays" = 5
      AND version."offDays" = 2
  );

UPDATE "schedule_templates" template
SET "currentVersionId" = version."id",
    "updatedAt" = CURRENT_TIMESTAMP
FROM "schedule_template_versions" version
WHERE template."isSystem" = true
  AND template."name" = '5/2'
  AND version."templateId" = template."id"
  AND version."workDays" = 5
  AND version."offDays" = 2
  AND version."version" = (
    SELECT MAX(latest."version")
    FROM "schedule_template_versions" latest
    WHERE latest."templateId" = template."id"
      AND latest."workDays" = 5
      AND latest."offDays" = 2
  )
  AND template."currentVersionId" IS DISTINCT FROM version."id";
