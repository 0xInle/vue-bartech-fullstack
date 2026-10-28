ALTER TABLE "venue_schedule_shift_settings"
  DROP CONSTRAINT "venue_schedule_shift_settings_pkey";

ALTER TABLE "venue_schedule_shift_settings"
  ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "venue_schedule_shift_settings"
  ADD CONSTRAINT "venue_schedule_shift_settings_pkey" PRIMARY KEY ("id");

CREATE INDEX "venue_schedule_shift_settings_venue_code_idx"
  ON "venue_schedule_shift_settings"("venueId", "shiftCode");

ALTER TABLE "schedule_template_days"
  ADD COLUMN "shiftSettingId" UUID;

UPDATE "schedule_template_days" AS day
SET "shiftSettingId" = setting."id"
FROM "schedule_template_versions" AS version
JOIN "schedule_templates" AS template ON template."id" = version."templateId"
JOIN "venue_schedule_shift_settings" AS setting ON setting."venueId" = template."venueId"
WHERE day."templateVersionId" = version."id"
  AND day."shiftCode" = setting."shiftCode";

ALTER TABLE "schedule_template_days"
  DROP COLUMN "shiftCode";
