ALTER TABLE "schedule_days"
  ADD COLUMN "shiftSettingId" UUID;

WITH unique_matches AS (
  SELECT
    setting."venueId",
    setting."shiftCode",
    setting."startMinute",
    setting."defaultDurationHours"
  FROM "venue_schedule_shift_settings" AS setting
  GROUP BY "venueId", "shiftCode", "startMinute", "defaultDurationHours"
  HAVING COUNT(*) = 1
)
UPDATE "schedule_days" AS day
SET "shiftSettingId" = setting_id."id"
FROM "schedules" AS schedule
JOIN unique_matches AS setting
  ON setting."venueId" = schedule."venueId"
JOIN "venue_schedule_shift_settings" AS setting_id
  ON setting_id."venueId" = setting."venueId"
  AND setting_id."shiftCode" = setting."shiftCode"
  AND setting_id."startMinute" = setting."startMinute"
  AND setting_id."defaultDurationHours" = setting."defaultDurationHours"
WHERE day."scheduleId" = schedule."id"
  AND day."shiftCode" = setting."shiftCode"
  AND day."shiftStartMinute" = setting."startMinute"
  AND day."shiftDurationHours" = setting."defaultDurationHours";

CREATE INDEX "schedule_days_shift_setting_id_idx"
  ON "schedule_days"("shiftSettingId");

ALTER TABLE "schedule_days"
  ADD CONSTRAINT "schedule_days_shiftSettingId_fkey"
  FOREIGN KEY ("shiftSettingId")
  REFERENCES "venue_schedule_shift_settings"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
