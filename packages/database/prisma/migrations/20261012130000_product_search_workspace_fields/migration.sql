ALTER TABLE "products" ADD COLUMN "searchTechnologyNormalized" TEXT;
ALTER TABLE "ingredient_details" ADD COLUMN "searchAttributesNormalized" TEXT;

UPDATE "products"
SET "searchTechnologyNormalized" = replace(
  lower(unaccent(regexp_replace(trim("technology"), '\s+', ' ', 'g'))),
  'ё',
  'е'
)
WHERE "technology" IS NOT NULL;

UPDATE "ingredient_details" i
SET "searchAttributesNormalized" = replace(
  lower(unaccent(regexp_replace(
    trim(concat_ws(
      ' ',
      i."categoryCode",
      i."brand",
      i."strength"::text,
      i."country",
      i."externalIdentifier"
    )),
    '\s+',
    ' ',
    'g'
  ))),
  'ё',
  'е'
);

ALTER TABLE "ingredient_details" ALTER COLUMN "searchAttributesNormalized" SET NOT NULL;

CREATE INDEX "products_venue_search_technology_fts_idx"
  ON "products" USING GIN (to_tsvector('simple', "searchTechnologyNormalized"))
  WHERE "venueId" IS NOT NULL AND "status" = 'ACTIVE' AND "searchTechnologyNormalized" IS NOT NULL;
CREATE INDEX "products_venue_search_technology_trgm_idx"
  ON "products" USING GIN ("searchTechnologyNormalized" gin_trgm_ops)
  WHERE "venueId" IS NOT NULL AND "status" = 'ACTIVE' AND "searchTechnologyNormalized" IS NOT NULL;
CREATE INDEX "ingredient_details_search_attributes_fts_idx"
  ON "ingredient_details" USING GIN (to_tsvector('simple', "searchAttributesNormalized"));
CREATE INDEX "ingredient_details_search_attributes_trgm_idx"
  ON "ingredient_details" USING GIN ("searchAttributesNormalized" gin_trgm_ops);
CREATE INDEX "product_components_search_idx"
  ON "product_components"("componentProductId", "componentVenueId", "parentVenueId");
