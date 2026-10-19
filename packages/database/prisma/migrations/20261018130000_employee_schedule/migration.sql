DO $$ BEGIN
  CREATE TYPE "ScheduleShiftType" AS ENUM ('NORMAL', 'NIGHT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ScheduleDayStatus" AS ENUM ('DAY_OFF', 'VACATION', 'SICK_LEAVE', 'NO_SHOW');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "DelegatedPermissionCode" ADD VALUE IF NOT EXISTS 'MANAGE_SCHEDULE';

DROP INDEX IF EXISTS "venue_memberships_user_venue_key";

ALTER TABLE "venue_memberships"
  ADD COLUMN "startedOn" DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN "endedOn" DATE;

UPDATE "venue_memberships"
SET "startedOn" = "createdAt"::date;

CREATE UNIQUE INDEX "venue_memberships_one_active_user_venue_key"
  ON "venue_memberships" ("userId", "venueId")
  WHERE "endedOn" IS NULL;

CREATE TABLE "venue_role_periods" (
  "id" UUID NOT NULL,
  "venueMembershipId" UUID NOT NULL,
  "role" "VenueRole" NOT NULL,
  "startedOn" DATE NOT NULL,
  "endedOn" DATE,
  "changedByUserId" UUID,
  "reason" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "venue_role_periods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "venue_role_periods_membership_fkey"
    FOREIGN KEY ("venueMembershipId") REFERENCES "venue_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "venue_role_periods_changed_by_fkey"
    FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "venue_role_periods_membership_start_idx"
  ON "venue_role_periods" ("venueMembershipId", "startedOn");

WITH role_events AS (
  SELECT
    "entityId" AS membership_id,
    ("metadata"->>'previousRole')::"VenueRole" AS previous_role,
    ("metadata"->>'newRole')::"VenueRole" AS new_role,
    "createdAt"::date AS change_date,
    "actorId" AS actor_id,
    row_number() OVER (
      PARTITION BY "entityId", "createdAt"::date
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS day_order
  FROM "audit_events"
  WHERE "eventType" = 'membership.role_changed'
    AND "entityType" = 'venue_membership'
    AND "metadata" ? 'previousRole'
    AND "metadata" ? 'newRole'
),
last_daily_events AS (
  SELECT * FROM role_events WHERE day_order = 1
),
initial_roles AS (
  SELECT DISTINCT ON (membership_id) membership_id, previous_role AS role
  FROM last_daily_events
  ORDER BY membership_id, change_date
),
periods AS (
  SELECT
    vm."id" AS membership_id,
    COALESCE(ir.role, vm."role") AS role,
    vm."startedOn" AS starts_on,
    COALESCE(
      (SELECT min(e.change_date) - 1 FROM last_daily_events e WHERE e.membership_id = vm."id"),
      vm."endedOn"
    ) AS ends_on,
    NULL::uuid AS actor_id,
    NULL::text AS reason
  FROM "venue_memberships" vm
  LEFT JOIN initial_roles ir ON ir.membership_id = vm."id"
  UNION ALL
  SELECT
    e.membership_id,
    e.new_role,
    e.change_date,
    lead(e.change_date) OVER (PARTITION BY e.membership_id ORDER BY e.change_date) - 1,
    e.actor_id,
    'Восстановлено из журнала смены должности'
  FROM last_daily_events e
)
INSERT INTO "venue_role_periods" (
  "id", "venueMembershipId", "role", "startedOn", "endedOn", "changedByUserId", "reason"
)
SELECT gen_random_uuid(), membership_id, role, starts_on, ends_on, actor_id, reason
FROM periods
WHERE starts_on IS NOT NULL AND (ends_on IS NULL OR ends_on >= starts_on);

CREATE FUNCTION prevent_venue_membership_period_overlap() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "venues" WHERE "id" = NEW."venueId" FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM "venue_memberships" existing
    WHERE existing."userId" = NEW."userId"
      AND existing."venueId" = NEW."venueId"
      AND existing."id" <> NEW."id"
      AND daterange(existing."startedOn", COALESCE(existing."endedOn", 'infinity'::date), '[]')
          && daterange(NEW."startedOn", COALESCE(NEW."endedOn", 'infinity'::date), '[]')
  ) THEN
    RAISE EXCEPTION 'Периоды членства сотрудника не должны пересекаться'
      USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "venue_membership_period_no_overlap"
  BEFORE INSERT OR UPDATE OF "userId", "venueId", "startedOn", "endedOn"
  ON "venue_memberships"
  FOR EACH ROW EXECUTE FUNCTION prevent_venue_membership_period_overlap();

CREATE FUNCTION prevent_venue_role_period_overlap() RETURNS trigger AS $$
DECLARE
  membership_start DATE;
  membership_end DATE;
BEGIN
  SELECT "startedOn", "endedOn" INTO membership_start, membership_end
  FROM "venue_memberships" WHERE "id" = NEW."venueMembershipId" FOR UPDATE;
  IF membership_start IS NULL OR NEW."startedOn" < membership_start
     OR (membership_end IS NOT NULL AND (NEW."endedOn" IS NULL OR NEW."endedOn" > membership_end)) THEN
    RAISE EXCEPTION 'Интервал должности должен находиться внутри периода членства'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "venue_role_periods" existing
    WHERE existing."venueMembershipId" = NEW."venueMembershipId"
      AND existing."id" <> NEW."id"
      AND daterange(existing."startedOn", COALESCE(existing."endedOn", 'infinity'::date), '[]')
          && daterange(NEW."startedOn", COALESCE(NEW."endedOn", 'infinity'::date), '[]')
  ) THEN
    RAISE EXCEPTION 'Интервалы должностей не должны пересекаться'
      USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "venue_role_period_no_overlap"
  BEFORE INSERT OR UPDATE OF "venueMembershipId", "startedOn", "endedOn"
  ON "venue_role_periods"
  FOR EACH ROW EXECUTE FUNCTION prevent_venue_role_period_overlap();

CREATE TABLE "venue_schedule_settings" (
  "venueId" UUID NOT NULL,
  "standardShiftDurationHours" INTEGER NOT NULL DEFAULT 12,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "venue_schedule_settings_pkey" PRIMARY KEY ("venueId"),
  CONSTRAINT "venue_schedule_settings_venue_fkey"
    FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "venue_schedule_settings_duration_check"
    CHECK ("standardShiftDurationHours" BETWEEN 1 AND 24)
);

CREATE TABLE "schedules" (
  "id" UUID NOT NULL,
  "venueId" UUID NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "schedules_venue_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "schedules_month_check" CHECK ("month" BETWEEN 1 AND 12),
  CONSTRAINT "schedules_year_check" CHECK ("year" BETWEEN 2000 AND 2200)
);
CREATE UNIQUE INDEX "schedules_venue_month_key" ON "schedules" ("venueId", "year", "month");
CREATE INDEX "schedules_venue_month_idx" ON "schedules" ("venueId", "year", "month");

CREATE TABLE "schedule_days" (
  "id" UUID NOT NULL,
  "scheduleId" UUID NOT NULL,
  "venueMembershipId" UUID NOT NULL,
  "date" DATE NOT NULL,
  "shiftDurationHours" INTEGER,
  "shiftType" "ScheduleShiftType",
  "status" "ScheduleDayStatus",
  "updatedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "schedule_days_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "schedule_days_schedule_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "schedule_days_membership_fkey" FOREIGN KEY ("venueMembershipId") REFERENCES "venue_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "schedule_days_updated_by_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "schedule_days_value_check" CHECK (
    ("shiftDurationHours" IS NULL AND "shiftType" IS NULL AND "status" IS NULL)
    OR ("shiftDurationHours" IS NOT NULL AND "shiftDurationHours" BETWEEN 1 AND 24 AND "shiftType" IS NOT NULL AND "status" IS NULL)
    OR ("shiftDurationHours" IS NULL AND "shiftType" IS NULL AND "status" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "schedule_days_membership_date_key" ON "schedule_days" ("venueMembershipId", "date");
CREATE INDEX "schedule_days_schedule_date_idx" ON "schedule_days" ("scheduleId", "date");

CREATE TABLE "schedule_day_changes" (
  "id" UUID NOT NULL,
  "scheduleDayId" UUID NOT NULL,
  "oldValue" JSONB,
  "newValue" JSONB,
  "changedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "schedule_day_changes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "schedule_day_changes_day_fkey" FOREIGN KEY ("scheduleDayId") REFERENCES "schedule_days"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "schedule_day_changes_changed_by_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "schedule_day_changes_day_created_idx" ON "schedule_day_changes" ("scheduleDayId", "createdAt");

CREATE TABLE "schedule_day_comments" (
  "scheduleDayId" UUID NOT NULL,
  "text" TEXT NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "schedule_day_comments_pkey" PRIMARY KEY ("scheduleDayId"),
  CONSTRAINT "schedule_day_comments_day_fkey" FOREIGN KEY ("scheduleDayId") REFERENCES "schedule_days"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "schedule_day_comments_updated_by_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "schedule_day_comment_versions" (
  "id" UUID NOT NULL,
  "scheduleDayId" UUID NOT NULL,
  "text" TEXT NOT NULL,
  "changedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "schedule_day_comment_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "schedule_day_comment_versions_comment_fkey" FOREIGN KEY ("scheduleDayId") REFERENCES "schedule_day_comments"("scheduleDayId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "schedule_day_comment_versions_changed_by_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "schedule_comment_versions_day_created_idx" ON "schedule_day_comment_versions" ("scheduleDayId", "createdAt");

CREATE TABLE "schedule_templates" (
  "id" UUID NOT NULL,
  "venueId" UUID,
  "name" TEXT NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "currentVersionId" UUID,
  "createdByUserId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "schedule_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "schedule_templates_venue_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "schedule_templates_created_by_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "schedule_templates_scope_check" CHECK (("isSystem" AND "venueId" IS NULL) OR (NOT "isSystem" AND "venueId" IS NOT NULL))
);
CREATE INDEX "schedule_templates_scope_name_idx" ON "schedule_templates" ("venueId", "isSystem", "name");

CREATE TABLE "schedule_template_versions" (
  "id" UUID NOT NULL,
  "templateId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "workDays" INTEGER NOT NULL,
  "offDays" INTEGER NOT NULL,
  "durationHours" INTEGER NOT NULL,
  "shiftType" "ScheduleShiftType" NOT NULL,
  "createdByUserId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "schedule_template_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "schedule_template_versions_template_fkey" FOREIGN KEY ("templateId") REFERENCES "schedule_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "schedule_template_versions_created_by_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "schedule_template_versions_cycle_check" CHECK ("workDays" BETWEEN 1 AND 31 AND "offDays" BETWEEN 1 AND 31),
  CONSTRAINT "schedule_template_versions_duration_check" CHECK ("durationHours" BETWEEN 1 AND 24),
  CONSTRAINT "schedule_template_versions_template_version_key" UNIQUE ("templateId", "version")
);

ALTER TABLE "schedule_templates"
  ADD CONSTRAINT "schedule_templates_current_version_fkey"
  FOREIGN KEY ("currentVersionId") REFERENCES "schedule_template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "schedule_templates_current_version_key" ON "schedule_templates" ("currentVersionId");

CREATE TABLE "schedule_assignments" (
  "venueMembershipId" UUID NOT NULL,
  "templateId" UUID NOT NULL,
  "templateVersionId" UUID NOT NULL,
  "cycleAnchorDate" DATE NOT NULL,
  "applyFromDate" DATE NOT NULL,
  "assignedByUserId" UUID NOT NULL,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "schedule_assignments_pkey" PRIMARY KEY ("venueMembershipId"),
  CONSTRAINT "schedule_assignments_membership_fkey" FOREIGN KEY ("venueMembershipId") REFERENCES "venue_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "schedule_assignments_template_fkey" FOREIGN KEY ("templateId") REFERENCES "schedule_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "schedule_assignments_version_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "schedule_template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "schedule_assignments_assigned_by_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "schedule_templates" ("id", "name", "isSystem", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), '2/2', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '3/3', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '4/2', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '5/1', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), '6/1', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "schedule_template_versions" (
  "id", "templateId", "version", "workDays", "offDays", "durationHours", "shiftType", "createdAt"
)
SELECT gen_random_uuid(), "id", 1,
  split_part("name", '/', 1)::integer,
  split_part("name", '/', 2)::integer,
  12,
  'NORMAL',
  CURRENT_TIMESTAMP
FROM "schedule_templates"
WHERE "isSystem";

UPDATE "schedule_templates" template
SET "currentVersionId" = version."id"
FROM "schedule_template_versions" version
WHERE version."templateId" = template."id";

INSERT INTO "venue_schedule_settings" ("venueId", "standardShiftDurationHours", "updatedAt")
SELECT "id", 12, CURRENT_TIMESTAMP FROM "venues";
