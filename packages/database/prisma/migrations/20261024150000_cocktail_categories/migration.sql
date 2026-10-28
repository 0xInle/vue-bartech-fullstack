CREATE TABLE "cocktail_categories" (
  "cocktailId" UUID NOT NULL,
  "cocktailVenueId" UUID NOT NULL,
  "referenceValueId" UUID NOT NULL,
  "referenceValueVenueId" UUID,
  CONSTRAINT "cocktail_categories_pkey" PRIMARY KEY ("cocktailId", "referenceValueId"),
  CONSTRAINT "cocktail_categories_cocktail_fkey"
    FOREIGN KEY ("cocktailId", "cocktailVenueId")
    REFERENCES "products"("id", "venueId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "cocktail_categories_reference_value_fkey"
    FOREIGN KEY ("referenceValueId", "referenceValueVenueId")
    REFERENCES "reference_values"("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "cocktail_categories_venue_cocktail_idx"
  ON "cocktail_categories"("cocktailVenueId", "cocktailId");
CREATE INDEX "cocktail_categories_value_venue_idx"
  ON "cocktail_categories"("referenceValueId", "cocktailVenueId");

INSERT INTO "reference_values" (
  "id", "type", "code", "label", "venueId", "sortOrder", "isActive", "createdByUserId", "createdAt"
)
VALUES
  (gen_random_uuid(), 'COCKTAIL_CATEGORY', 'klassika', 'Классика', NULL, 0, true, NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'COCKTAIL_CATEGORY', 'avtorskiy', 'Авторский', NULL, 0, true, NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'COCKTAIL_CATEGORY', 'tvist', 'Твист', NULL, 0, true, NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'COCKTAIL_CATEGORY', 'sezonnyy', 'Сезонный', NULL, 0, true, NULL, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'COCKTAIL_CATEGORY', 'bezalkogolnyy', 'Безалкогольный', NULL, 0, true, NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("type", "code") WHERE "venueId" IS NULL DO NOTHING;
