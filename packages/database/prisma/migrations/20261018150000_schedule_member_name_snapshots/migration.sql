CREATE TABLE "schedule_member_snapshots" (
  "scheduleId" UUID NOT NULL,
  "venueMembershipId" UUID NOT NULL,
  "fullName" TEXT NOT NULL,
  CONSTRAINT "schedule_member_snapshots_pkey" PRIMARY KEY ("scheduleId", "venueMembershipId"),
  CONSTRAINT "schedule_member_snapshots_schedule_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "schedule_member_snapshots_membership_fkey"
    FOREIGN KEY ("venueMembershipId") REFERENCES "venue_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "schedule_member_snapshots" ("scheduleId", "venueMembershipId", "fullName")
SELECT DISTINCT s."id", vm."id", COALESCE(up."fullName", '')
FROM "schedules" s
JOIN "venue_memberships" vm
  ON vm."venueId" = s."venueId"
  AND vm."startedOn" <= make_date(s."year", s."month", 1) + INTERVAL '1 month' - INTERVAL '1 day'
  AND (vm."endedOn" IS NULL OR vm."endedOn" >= make_date(s."year", s."month", 1))
JOIN "venue_role_periods" vrp
  ON vrp."venueMembershipId" = vm."id"
  AND vrp."startedOn" <= make_date(s."year", s."month", 1) + INTERVAL '1 month' - INTERVAL '1 day'
  AND (vrp."endedOn" IS NULL OR vrp."endedOn" >= make_date(s."year", s."month", 1))
LEFT JOIN "user_profiles" up ON up."userId" = vm."userId"
ON CONFLICT ("scheduleId", "venueMembershipId") DO NOTHING;
