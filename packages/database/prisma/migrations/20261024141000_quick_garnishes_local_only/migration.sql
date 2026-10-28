ALTER TABLE "reference_values"
  ADD CONSTRAINT "reference_values_garnish_local_check"
  CHECK ("type" <> 'GARNISH' OR "venueId" IS NOT NULL);
