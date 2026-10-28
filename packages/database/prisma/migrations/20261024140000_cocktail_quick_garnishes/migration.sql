ALTER TYPE "ReferenceValueType" ADD VALUE 'GARNISH';

CREATE TABLE "cocktail_quick_garnishes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cocktailId" UUID NOT NULL,
  "cocktailVenueId" UUID NOT NULL,
  "referenceValueId" UUID NOT NULL,
  "referenceValueVenueId" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "cocktail_quick_garnishes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cocktail_quick_garnishes_same_venue_check"
    CHECK ("cocktailVenueId" = "referenceValueVenueId"),
  CONSTRAINT "cocktail_quick_garnishes_cocktail_fkey"
    FOREIGN KEY ("cocktailId", "cocktailVenueId")
    REFERENCES "products"("id", "venueId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "cocktail_quick_garnishes_reference_value_fkey"
    FOREIGN KEY ("referenceValueId", "referenceValueVenueId")
    REFERENCES "reference_values"("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "cocktail_quick_garnishes_cocktail_value_key"
  ON "cocktail_quick_garnishes"("cocktailId", "referenceValueId");
CREATE UNIQUE INDEX "cocktail_quick_garnishes_cocktail_position_key"
  ON "cocktail_quick_garnishes"("cocktailId", "position");
