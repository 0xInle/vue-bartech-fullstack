DROP TRIGGER "venue_membership_period_no_overlap" ON "venue_memberships";
DROP TRIGGER "venue_role_period_no_overlap" ON "venue_role_periods";

UPDATE "venue_memberships"
SET "endedOn" = "endedOn" + 1
WHERE "endedOn" IS NOT NULL;

UPDATE "venue_role_periods"
SET "endedOn" = "endedOn" + 1
WHERE "endedOn" IS NOT NULL;

CREATE OR REPLACE FUNCTION prevent_venue_membership_period_overlap() RETURNS trigger AS $$
BEGIN
  PERFORM 1 FROM "venues" WHERE "id" = NEW."venueId" FOR UPDATE;
  IF NEW."endedOn" IS NOT NULL AND NEW."endedOn" < NEW."startedOn" THEN
    RAISE EXCEPTION 'Конец периода членства не может быть раньше начала'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "venue_memberships" existing
    WHERE existing."userId" = NEW."userId"
      AND existing."venueId" = NEW."venueId"
      AND existing."id" <> NEW."id"
      AND daterange(existing."startedOn", COALESCE(existing."endedOn", 'infinity'::date), '[)')
          && daterange(NEW."startedOn", COALESCE(NEW."endedOn", 'infinity'::date), '[)')
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

CREATE OR REPLACE FUNCTION prevent_venue_role_period_overlap() RETURNS trigger AS $$
DECLARE
  membership_start DATE;
  membership_end DATE;
BEGIN
  SELECT "startedOn", "endedOn" INTO membership_start, membership_end
  FROM "venue_memberships" WHERE "id" = NEW."venueMembershipId" FOR UPDATE;
  IF membership_start IS NULL OR NEW."startedOn" < membership_start
     OR (NEW."endedOn" IS NOT NULL AND NEW."endedOn" < NEW."startedOn")
     OR (membership_end IS NOT NULL AND (NEW."endedOn" IS NULL OR NEW."endedOn" > membership_end)) THEN
    RAISE EXCEPTION 'Интервал должности должен находиться внутри периода членства'
      USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "venue_role_periods" existing
    WHERE existing."venueMembershipId" = NEW."venueMembershipId"
      AND existing."id" <> NEW."id"
      AND daterange(existing."startedOn", COALESCE(existing."endedOn", 'infinity'::date), '[)')
          && daterange(NEW."startedOn", COALESCE(NEW."endedOn", 'infinity'::date), '[)')
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
