ALTER TABLE "cocktail_categories"
  DROP CONSTRAINT "cocktail_categories_reference_value_fkey",
  DROP COLUMN "referenceValueVenueId",
  ADD CONSTRAINT "cocktail_categories_reference_value_fkey"
    FOREIGN KEY ("referenceValueId")
    REFERENCES "reference_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
