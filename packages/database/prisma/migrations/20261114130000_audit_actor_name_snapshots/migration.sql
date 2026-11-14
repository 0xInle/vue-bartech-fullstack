UPDATE "audit_events" AS event
SET "metadata" = jsonb_set(
  COALESCE(event."metadata", '{}'::jsonb),
  '{actorName}',
  to_jsonb(profile."fullName"),
  true
)
FROM "user_profiles" AS profile
WHERE event."actorType" = 'USER'
  AND event."actorId" = profile."userId"
  AND NOT (COALESCE(event."metadata", '{}'::jsonb) ? 'actorName');

CREATE OR REPLACE FUNCTION capture_audit_actor_name() RETURNS trigger AS $$
DECLARE
  actor_name TEXT;
BEGIN
  IF NEW."actorType" = 'USER' AND NEW."actorId" IS NOT NULL THEN
    IF NEW."metadata" IS NULL THEN
      NEW."metadata" := '{}'::jsonb;
    END IF;

    IF NOT (NEW."metadata" ? 'actorName') THEN
      SELECT profile."fullName"
      INTO actor_name
      FROM "user_profiles" AS profile
      WHERE profile."userId" = NEW."actorId";

      IF actor_name IS NOT NULL THEN
        NEW."metadata" := jsonb_set(NEW."metadata", '{actorName}', to_jsonb(actor_name), true);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_actor_name_snapshot
BEFORE INSERT ON "audit_events"
FOR EACH ROW
EXECUTE FUNCTION capture_audit_actor_name();
