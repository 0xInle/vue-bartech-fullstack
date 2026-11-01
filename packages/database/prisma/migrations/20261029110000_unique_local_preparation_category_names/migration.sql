CREATE UNIQUE INDEX "preparation_categories_venue_normalized_name_key"
  ON "preparation_categories" (
    "venueId",
    lower(regexp_replace(btrim("name"), '\s+', ' ', 'g'))
  )
  WHERE "venueId" IS NOT NULL;
