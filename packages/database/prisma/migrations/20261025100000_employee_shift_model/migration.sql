-- Моковые графики и N/M-циклы сбрасываются по согласованной спецификации.
DELETE FROM "schedule_assignments";
UPDATE "schedule_templates" SET "currentVersionId" = NULL;
DELETE FROM "schedule_templates";
DELETE FROM "schedules";

ALTER TABLE "schedule_days" DROP CONSTRAINT "schedule_days_value_check";
ALTER TABLE "schedule_days" DROP COLUMN "shiftType";
ALTER TABLE "schedule_days" ADD COLUMN "shiftCode" TEXT;
ALTER TABLE "schedule_days" ADD COLUMN "shiftStartMinute" INTEGER;
ALTER TABLE "schedule_days"
  ADD CONSTRAINT "schedule_days_value_check" CHECK (
    ("shiftDurationHours" IS NULL AND "shiftCode" IS NULL AND "shiftStartMinute" IS NULL AND "status" IS NULL)
    OR ("shiftDurationHours" BETWEEN 1 AND 24 AND "shiftCode" IS NOT NULL AND "shiftStartMinute" BETWEEN 0 AND 1439 AND "status" IS NULL)
    OR ("shiftDurationHours" IS NULL AND "shiftCode" IS NULL AND "shiftStartMinute" IS NULL AND "status" IS NOT NULL)
  );

ALTER TABLE "schedule_template_versions" DROP CONSTRAINT "schedule_template_versions_cycle_check";
ALTER TABLE "schedule_template_versions" DROP CONSTRAINT "schedule_template_versions_duration_check";
ALTER TABLE "schedule_template_versions" DROP COLUMN "workDays";
ALTER TABLE "schedule_template_versions" DROP COLUMN "offDays";
ALTER TABLE "schedule_template_versions" DROP COLUMN "durationHours";
ALTER TABLE "schedule_template_versions" DROP COLUMN "shiftType";

DROP TYPE "ScheduleShiftType";
CREATE TYPE "ScheduleShiftCode" AS ENUM ('MORNING', 'DAY', 'EVENING', 'NIGHT');
ALTER TABLE "schedule_days" ALTER COLUMN "shiftCode" TYPE "ScheduleShiftCode" USING NULL::"ScheduleShiftCode";

CREATE TABLE "venue_schedule_shift_settings" (
  "venueId" UUID NOT NULL,
  "shiftCode" "ScheduleShiftCode" NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "defaultDurationHours" INTEGER NOT NULL,
  CONSTRAINT "venue_schedule_shift_settings_pkey" PRIMARY KEY ("venueId", "shiftCode"),
  CONSTRAINT "venue_schedule_shift_settings_venue_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "venue_schedule_shift_settings_start_check" CHECK ("startMinute" BETWEEN 0 AND 1439),
  CONSTRAINT "venue_schedule_shift_settings_duration_check" CHECK ("defaultDurationHours" BETWEEN 1 AND 24)
);

CREATE TABLE "schedule_template_days" (
  "templateVersionId" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "shiftCode" "ScheduleShiftCode",
  CONSTRAINT "schedule_template_days_pkey" PRIMARY KEY ("templateVersionId", "position"),
  CONSTRAINT "schedule_template_days_version_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "schedule_template_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "schedule_template_days_position_check" CHECK ("position" BETWEEN 0 AND 30)
);
