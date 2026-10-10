ALTER TYPE "VenueRole" ADD VALUE 'BARTENDER' BEFORE 'BAR_MANAGER';
ALTER TYPE "VenueRole" ADD VALUE 'SENIOR_BARTENDER' BEFORE 'BAR_MANAGER';

CREATE TYPE "DelegatedPermissionCode" AS ENUM (
  'MANAGE_PRODUCTS',
  'MANAGE_PRODUCT_ARCHIVE',
  'DELETE_PRODUCTS_PERMANENTLY',
  'EXPORT_DATA',
  'INVITE_EMPLOYEES'
);

CREATE UNIQUE INDEX "venue_memberships_id_venue_key" ON "venue_memberships"("id", "venueId");

CREATE TABLE "delegated_permissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "venueMembershipId" UUID NOT NULL,
  "code" "DelegatedPermissionCode" NOT NULL,
  "grantedByUserId" UUID NOT NULL,
  "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delegated_permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "delegated_permissions_membership_code_key"
  ON "delegated_permissions"("venueMembershipId", "code");
CREATE INDEX "delegated_permissions_granted_by_idx"
  ON "delegated_permissions"("grantedByUserId");
ALTER TABLE "delegated_permissions" ADD CONSTRAINT "delegated_permissions_venueMembershipId_fkey"
  FOREIGN KEY ("venueMembershipId") REFERENCES "venue_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "delegated_permissions" ADD CONSTRAINT "delegated_permissions_grantedByUserId_fkey"
  FOREIGN KEY ("grantedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "temporary_responsibilities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "venueId" UUID NOT NULL,
  "venueMembershipId" UUID NOT NULL,
  "assignedByUserId" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "temporary_responsibilities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "temporary_responsibilities_venue_key"
  ON "temporary_responsibilities"("venueId");
CREATE UNIQUE INDEX "temporary_responsibilities_membership_venue_key"
  ON "temporary_responsibilities"("venueMembershipId", "venueId");
CREATE INDEX "temporary_responsibilities_assigned_by_idx"
  ON "temporary_responsibilities"("assignedByUserId");
ALTER TABLE "temporary_responsibilities" ADD CONSTRAINT "temporary_responsibilities_venueId_fkey"
  FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "temporary_responsibilities" ADD CONSTRAINT "temporary_responsibilities_membership_venue_fkey"
  FOREIGN KEY ("venueMembershipId", "venueId")
  REFERENCES "venue_memberships"("id", "venueId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "temporary_responsibilities" ADD CONSTRAINT "temporary_responsibilities_assignedByUserId_fkey"
  FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "company_memberships" AS company_membership
    JOIN "venue_memberships" AS venue_membership
      ON venue_membership."userId" = company_membership."userId"
      AND venue_membership."companyId" = company_membership."companyId"
    WHERE company_membership."companyRole" = 'CHEF_BARTENDER'
  ) THEN
    RAISE EXCEPTION 'Cannot migrate conflicting chef and venue memberships';
  END IF;
END;
$$;

CREATE FUNCTION require_read_committed_membership_writes() RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Membership writes require READ COMMITTED isolation'
      USING ERRCODE = '0A000';
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER company_membership_isolation_guard
BEFORE INSERT OR UPDATE OR DELETE ON "company_memberships"
FOR EACH STATEMENT
EXECUTE FUNCTION require_read_committed_membership_writes();

CREATE TRIGGER venue_membership_isolation_guard
BEFORE INSERT OR UPDATE OR DELETE ON "venue_memberships"
FOR EACH STATEMENT
EXECUTE FUNCTION require_read_committed_membership_writes();

CREATE FUNCTION lock_company_membership_pair(user_id UUID, company_id UUID) RETURNS VOID
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
  -- Hash collisions can only serialize extra pairs; explicit invariant checks remain authoritative.
  PERFORM pg_advisory_xact_lock(hashtextextended(user_id::TEXT || ':' || company_id::TEXT, 721804));
END;
$$;

CREATE FUNCTION prevent_chef_with_venue_membership() RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."userId" < NEW."userId"
      OR (OLD."userId" = NEW."userId" AND OLD."companyId" < NEW."companyId") THEN
      PERFORM lock_company_membership_pair(OLD."userId", OLD."companyId");
      PERFORM lock_company_membership_pair(NEW."userId", NEW."companyId");
    ELSE
      PERFORM lock_company_membership_pair(NEW."userId", NEW."companyId");
      PERFORM lock_company_membership_pair(OLD."userId", OLD."companyId");
    END IF;
  ELSE
    PERFORM lock_company_membership_pair(NEW."userId", NEW."companyId");
  END IF;

  IF NEW."companyRole" = 'CHEF_BARTENDER' AND EXISTS (
    SELECT 1
    FROM "venue_memberships"
    WHERE "userId" = NEW."userId"
      AND "companyId" = NEW."companyId"
  ) THEN
    RAISE EXCEPTION 'A chef bartender cannot have a venue membership in the same company'
      USING ERRCODE = '23514', CONSTRAINT = 'company_memberships_chef_local_role_exclusive';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER company_membership_chef_role_guard
BEFORE INSERT OR UPDATE OF "companyRole", "userId", "companyId" ON "company_memberships"
FOR EACH ROW
EXECUTE FUNCTION prevent_chef_with_venue_membership();

CREATE FUNCTION prevent_venue_membership_for_chef() RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."userId" < NEW."userId"
      OR (OLD."userId" = NEW."userId" AND OLD."companyId" < NEW."companyId") THEN
      PERFORM lock_company_membership_pair(OLD."userId", OLD."companyId");
      PERFORM lock_company_membership_pair(NEW."userId", NEW."companyId");
    ELSE
      PERFORM lock_company_membership_pair(NEW."userId", NEW."companyId");
      PERFORM lock_company_membership_pair(OLD."userId", OLD."companyId");
    END IF;
  ELSE
    PERFORM lock_company_membership_pair(NEW."userId", NEW."companyId");
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "company_memberships"
    WHERE "userId" = NEW."userId"
      AND "companyId" = NEW."companyId"
      AND "companyRole" = 'CHEF_BARTENDER'
  ) THEN
    RAISE EXCEPTION 'A chef bartender cannot have a venue membership in the same company'
      USING ERRCODE = '23514', CONSTRAINT = 'company_memberships_chef_local_role_exclusive';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER venue_membership_chef_role_guard
BEFORE INSERT OR UPDATE OF "userId", "companyId" ON "venue_memberships"
FOR EACH ROW
EXECUTE FUNCTION prevent_venue_membership_for_chef();
