CREATE TYPE "InvitationPurpose" AS ENUM ('JOIN_EXISTING_VENUE', 'JOIN_COMPANY_AS_CHEF');

ALTER TABLE "invitations"
  ADD COLUMN "purpose" "InvitationPurpose" NOT NULL DEFAULT 'JOIN_EXISTING_VENUE',
  ALTER COLUMN "venueId" DROP NOT NULL,
  ALTER COLUMN "role" DROP NOT NULL;

ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_purpose_target_check"
  CHECK (
    ("purpose" = 'JOIN_EXISTING_VENUE' AND "venueId" IS NOT NULL AND "role" IS NOT NULL)
    OR ("purpose" = 'JOIN_COMPANY_AS_CHEF' AND "venueId" IS NULL AND "role" IS NULL)
  );

DROP INDEX "invitations_one_open_per_email_venue_key";
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
