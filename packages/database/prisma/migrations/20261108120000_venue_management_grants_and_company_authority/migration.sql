ALTER TABLE "companies"
  ADD COLUMN "initialCreatorUserId" UUID,
  ADD COLUMN "authorityHistoryKnown" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "managementRoleEverPresent" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "authorityTransferredEver" BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE "companies"
  ADD CONSTRAINT "companies_initial_creator_user_id_fkey"
    FOREIGN KEY ("initialCreatorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "venue_memberships"
  ADD COLUMN "hasFullManagementPackage" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "fullManagementChangedAt" TIMESTAMPTZ(6),
  ADD COLUMN "fullManagementChangedByUserId" UUID;

UPDATE "venue_memberships"
SET "hasFullManagementPackage" = TRUE,
    "fullManagementChangedAt" = "createdAt"
WHERE "role" = 'BAR_MANAGER';

ALTER TABLE "venue_memberships"
  ADD CONSTRAINT "venue_memberships_management_package_changed_by_fkey"
    FOREIGN KEY ("fullManagementChangedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "companies_initial_creator_user_id_idx"
  ON "companies"("initialCreatorUserId");
CREATE INDEX "venue_memberships_full_management_package_idx"
  ON "venue_memberships"("venueId", "hasFullManagementPackage", "endedOn");
