CREATE TYPE "ScheduleDateMarkerType" AS ENUM ('INVENTORY');

CREATE TABLE "schedule_date_markers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "scheduleId" UUID NOT NULL,
  "date" DATE NOT NULL,
  "type" "ScheduleDateMarkerType" NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "schedule_date_markers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "schedule_date_markers_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "schedule_date_markers_schedule_date_key"
  ON "schedule_date_markers"("scheduleId", "date");
