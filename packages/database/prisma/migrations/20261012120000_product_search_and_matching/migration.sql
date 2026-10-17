CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE "products" ADD COLUMN "searchNameNormalized" TEXT;
ALTER TABLE "ingredient_details" ADD COLUMN "searchBrandNormalized" TEXT;
ALTER TABLE "product_aliases" ADD COLUMN "searchValueNormalized" TEXT;
ALTER TABLE "product_aliases" ADD COLUMN "isConfirmed" BOOLEAN NOT NULL DEFAULT false;

UPDATE "products"
SET "searchNameNormalized" = replace(lower(unaccent(regexp_replace(trim("name"), '\s+', ' ', 'g'))), 'ё', 'е');

UPDATE "ingredient_details"
SET "searchBrandNormalized" = replace(lower(unaccent(regexp_replace(trim("brand"), '\s+', ' ', 'g'))), 'ё', 'е')
WHERE "brand" IS NOT NULL;

UPDATE "product_aliases"
SET "searchValueNormalized" = replace(lower(unaccent(regexp_replace(trim("value"), '\s+', ' ', 'g'))), 'ё', 'е'),
    "isConfirmed" = true;

ALTER TABLE "products" ALTER COLUMN "searchNameNormalized" SET NOT NULL;
ALTER TABLE "product_aliases" ALTER COLUMN "searchValueNormalized" SET NOT NULL;

CREATE TYPE "CatalogMatchRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'NEEDS_REVIEW', 'RESOLVED');
CREATE TYPE "CatalogMatchReason" AS ENUM (
  'FUZZY_NAME',
  'ATTRIBUTE_CONFLICT',
  'MULTIPLE_CANDIDATES',
  'NO_CONFIDENT_MATCH'
);

CREATE TABLE "catalog_match_requests" (
  "id" UUID NOT NULL,
  "localProductId" UUID NOT NULL,
  "suggestedGlobalProductId" UUID,
  "status" "CatalogMatchRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reason" "CatalogMatchReason" NOT NULL,
  "confidence" DOUBLE PRECISION,
  "processedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "catalog_match_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "catalog_match_requests_local_product_key" UNIQUE ("localProductId"),
  CONSTRAINT "catalog_match_requests_local_product_fkey"
    FOREIGN KEY ("localProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "catalog_match_requests_suggested_product_fkey"
    FOREIGN KEY ("suggestedGlobalProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "catalog_match_requests_confidence_check"
    CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1))
);

CREATE INDEX "catalog_match_requests_status_processed_idx"
  ON "catalog_match_requests"("status", "processedAt");
CREATE INDEX "ingredient_details_search_brand_idx"
  ON "ingredient_details"("searchBrandNormalized")
  WHERE "searchBrandNormalized" IS NOT NULL;
CREATE INDEX "ingredient_details_external_identifier_idx"
  ON "ingredient_details"(lower("externalIdentifier"))
  WHERE "externalIdentifier" IS NOT NULL;

CREATE INDEX "products_global_search_name_fts_idx"
  ON "products" USING GIN (to_tsvector('simple', "searchNameNormalized"))
  WHERE "type" = 'INGREDIENT' AND "venueId" IS NULL AND "status" = 'ACTIVE';
CREATE INDEX "products_global_search_name_trgm_idx"
  ON "products" USING GIN ("searchNameNormalized" gin_trgm_ops)
  WHERE "type" = 'INGREDIENT' AND "venueId" IS NULL AND "status" = 'ACTIVE';
CREATE INDEX "products_venue_search_name_fts_idx"
  ON "products" USING GIN (to_tsvector('simple', "searchNameNormalized"))
  WHERE "venueId" IS NOT NULL AND "status" = 'ACTIVE';
CREATE INDEX "products_venue_search_name_trgm_idx"
  ON "products" USING GIN ("searchNameNormalized" gin_trgm_ops)
  WHERE "venueId" IS NOT NULL AND "status" = 'ACTIVE';
CREATE INDEX "product_aliases_search_value_fts_idx"
  ON "product_aliases" USING GIN (to_tsvector('simple', "searchValueNormalized"))
  WHERE "isConfirmed" = true;
CREATE INDEX "product_aliases_search_value_trgm_idx"
  ON "product_aliases" USING GIN ("searchValueNormalized" gin_trgm_ops)
  WHERE "isConfirmed" = true;
