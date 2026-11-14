ALTER TYPE "InvitationPurpose"
  RENAME VALUE 'CREATE_VENUE_AS_BAR_MANAGER' TO 'CREATE_VENUE';

ALTER TABLE "invitations"
  DROP CONSTRAINT "invitations_purpose_target_check";

ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_purpose_target_check"
    CHECK (
      ("purpose" = 'JOIN_EXISTING_VENUE' AND "venueId" IS NOT NULL AND "role" IS NOT NULL)
      OR ("purpose" = 'JOIN_COMPANY_AS_CHEF' AND "venueId" IS NULL AND "role" IS NULL)
      OR (
        "purpose" = 'CREATE_VENUE'
        AND "companyId" IS NOT NULL
        AND "venueId" IS NULL
        AND "role" IN ('BAR_MANAGER', 'SENIOR_BARTENDER', 'BARTENDER')
      )
    );
