ALTER TABLE "invitations"
  DROP CONSTRAINT "invitations_purpose_target_check";

DROP INDEX "invitations_one_open_per_email_venue_key";
DROP INDEX "invitations_one_open_chef_per_email_company_key";
DROP INDEX "invitations_company_purpose_status_expiry_idx";

CREATE TYPE "InvitationPurpose_new" AS ENUM (
  'JOIN_EXISTING_VENUE',
  'JOIN_COMPANY_AS_CHEF',
  'CREATE_VENUE_AS_BAR_MANAGER'
);

ALTER TABLE "invitations"
  ALTER COLUMN "purpose" DROP DEFAULT,
  ALTER COLUMN "purpose" TYPE "InvitationPurpose_new"
    USING ("purpose"::text::"InvitationPurpose_new");

DROP TYPE "InvitationPurpose";
ALTER TYPE "InvitationPurpose_new" RENAME TO "InvitationPurpose";

ALTER TABLE "invitations"
  ALTER COLUMN "purpose" SET DEFAULT 'JOIN_EXISTING_VENUE';

ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_purpose_target_check"
    CHECK (
      ("purpose" = 'JOIN_EXISTING_VENUE' AND "venueId" IS NOT NULL AND "role" IS NOT NULL)
      OR ("purpose" = 'JOIN_COMPANY_AS_CHEF' AND "venueId" IS NULL AND "role" IS NULL)
      OR (
        "purpose" = 'CREATE_VENUE_AS_BAR_MANAGER'
        AND "companyId" IS NOT NULL
        AND "venueId" IS NULL
        AND "role" = 'BAR_MANAGER'
      )
    );

CREATE UNIQUE INDEX "invitations_one_open_per_email_venue_key"
  ON "invitations"("emailNormalized", "venueId")
  WHERE "purpose" = 'JOIN_EXISTING_VENUE'
    AND "venueId" IS NOT NULL
    AND "status" IN ('ACTIVE', 'IN_PROGRESS');

CREATE UNIQUE INDEX "invitations_one_open_chef_per_email_company_key"
  ON "invitations"("emailNormalized", "companyId")
  WHERE "purpose" = 'JOIN_COMPANY_AS_CHEF'
    AND "status" IN ('ACTIVE', 'IN_PROGRESS');

CREATE INDEX "invitations_company_purpose_status_expiry_idx"
  ON "invitations"("companyId", "purpose", "status", "expiresAt");

CREATE UNIQUE INDEX "invitations_one_open_new_venue_per_email_company_key"
  ON "invitations"("emailNormalized", "companyId")
  WHERE "purpose" = 'CREATE_VENUE_AS_BAR_MANAGER'
    AND "status" IN ('ACTIVE', 'IN_PROGRESS');
