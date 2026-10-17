CREATE TYPE "ProductType" AS ENUM ('INGREDIENT', 'PREPARATION', 'GARNISH', 'COCKTAIL');
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE');
CREATE TYPE "QuantityKind" AS ENUM ('VOLUME', 'MASS', 'COUNT', 'BAR_MEASURE');
CREATE TYPE "ReferenceValueType" AS ENUM ('GLASS', 'ICE', 'PREPARATION_METHOD');

CREATE TABLE "ingredient_categories" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "parentCode" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ingredient_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ingredient_categories_code_key" UNIQUE ("code"),
  CONSTRAINT "ingredient_categories_parentCode_fkey"
    FOREIGN KEY ("parentCode") REFERENCES "ingredient_categories"("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "preparation_categories" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "preparation_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "preparation_categories_code_key" UNIQUE ("code")
);

CREATE TABLE "units" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "kind" "QuantityKind",
  "venueId" UUID,
  "createdByUserId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "units_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "units_id_venue_id_key" UNIQUE ("id", "venueId"),
  CONSTRAINT "units_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "units_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "reference_values" (
  "id" UUID NOT NULL,
  "type" "ReferenceValueType" NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "venueId" UUID,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reference_values_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reference_values_id_venue_id_key" UNIQUE ("id", "venueId"),
  CONSTRAINT "reference_values_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "reference_values_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "products" (
  "id" UUID NOT NULL,
  "type" "ProductType" NOT NULL,
  "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
  "venueId" UUID,
  "name" TEXT NOT NULL,
  "nameNormalized" TEXT NOT NULL,
  "catalogIdentityKey" TEXT,
  "catalogSeedManaged" BOOLEAN NOT NULL DEFAULT false,
  "technology" TEXT,
  "comment" TEXT,
  "outputAmount" DECIMAL(12,3),
  "outputUnitId" UUID,
  "createdByUserId" UUID,
  "updatedByUserId" UUID,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "products_id_venue_id_key" UNIQUE ("id", "venueId"),
  CONSTRAINT "products_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "products_outputUnitId_fkey" FOREIGN KEY ("outputUnitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "products_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "products_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "products_type_scope_check" CHECK ("type" = 'INGREDIENT' OR "venueId" IS NOT NULL),
  CONSTRAINT "products_technology_check" CHECK (
    ("type" = 'INGREDIENT' AND "technology" IS NULL) OR
    ("type" <> 'INGREDIENT' AND length(trim("technology")) > 0)
  ),
  CONSTRAINT "products_output_check" CHECK (
    ("outputAmount" IS NULL AND "outputUnitId" IS NULL) OR
    ("outputAmount" > 0 AND "outputUnitId" IS NOT NULL)
  )
);

CREATE TABLE "ingredient_details" (
  "productId" UUID NOT NULL,
  "categoryCode" TEXT NOT NULL,
  "brand" TEXT,
  "brandNormalized" TEXT,
  "strength" DECIMAL(5,2),
  "country" TEXT,
  "externalIdentifier" TEXT,
  CONSTRAINT "ingredient_details_pkey" PRIMARY KEY ("productId"),
  CONSTRAINT "ingredient_details_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ingredient_details_categoryCode_fkey" FOREIGN KEY ("categoryCode") REFERENCES "ingredient_categories"("code") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ingredient_details_strength_check" CHECK ("strength" IS NULL OR ("strength" >= 0 AND "strength" <= 100))
);

CREATE TABLE "preparation_details" (
  "productId" UUID NOT NULL,
  "categoryCode" TEXT NOT NULL,
  CONSTRAINT "preparation_details_pkey" PRIMARY KEY ("productId"),
  CONSTRAINT "preparation_details_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "preparation_details_categoryCode_fkey" FOREIGN KEY ("categoryCode") REFERENCES "preparation_categories"("code") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "cocktail_details" (
  "productId" UUID NOT NULL,
  "glassId" UUID,
  "iceId" UUID,
  "preparationMethodId" UUID,
  CONSTRAINT "cocktail_details_pkey" PRIMARY KEY ("productId"),
  CONSTRAINT "cocktail_details_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "cocktail_details_glassId_fkey" FOREIGN KEY ("glassId") REFERENCES "reference_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "cocktail_details_iceId_fkey" FOREIGN KEY ("iceId") REFERENCES "reference_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "cocktail_details_preparationMethodId_fkey" FOREIGN KEY ("preparationMethodId") REFERENCES "reference_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "product_components" (
  "id" UUID NOT NULL,
  "parentProductId" UUID NOT NULL,
  "parentVenueId" UUID NOT NULL,
  "componentProductId" UUID NOT NULL,
  "componentVenueId" UUID,
  "unitId" UUID NOT NULL,
  "amount" DECIMAL(12,3) NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "product_components_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_components_parent_position_key" UNIQUE ("parentProductId", "position"),
  CONSTRAINT "product_components_parent_fkey" FOREIGN KEY ("parentProductId", "parentVenueId") REFERENCES "products"("id", "venueId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_components_component_fkey" FOREIGN KEY ("componentProductId", "componentVenueId") REFERENCES "products"("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "product_components_component_id_fkey" FOREIGN KEY ("componentProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "product_components_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "product_components_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "product_components_position_check" CHECK ("position" >= 0)
);

CREATE TABLE "cocktail_garnishes" (
  "id" UUID NOT NULL,
  "cocktailId" UUID NOT NULL,
  "cocktailVenueId" UUID NOT NULL,
  "garnishId" UUID NOT NULL,
  "garnishVenueId" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "cocktail_garnishes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cocktail_garnishes_cocktail_garnish_key" UNIQUE ("cocktailId", "garnishId"),
  CONSTRAINT "cocktail_garnishes_cocktail_position_key" UNIQUE ("cocktailId", "position"),
  CONSTRAINT "cocktail_garnishes_cocktail_fkey" FOREIGN KEY ("cocktailId", "cocktailVenueId") REFERENCES "products"("id", "venueId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "cocktail_garnishes_garnish_fkey" FOREIGN KEY ("garnishId", "garnishVenueId") REFERENCES "products"("id", "venueId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "cocktail_garnishes_same_venue_check" CHECK ("cocktailVenueId" = "garnishVenueId"),
  CONSTRAINT "cocktail_garnishes_position_check" CHECK ("position" >= 0)
);

CREATE TABLE "product_aliases" (
  "id" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "value" TEXT NOT NULL,
  "valueNormalized" TEXT NOT NULL,
  "language" TEXT,
  CONSTRAINT "product_aliases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_aliases_value_normalized_key" UNIQUE ("valueNormalized"),
  CONSTRAINT "product_aliases_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "products_venue_type_name_active_key"
  ON "products"("venueId", "type", "nameNormalized")
  WHERE "venueId" IS NOT NULL AND "status" = 'ACTIVE';
CREATE UNIQUE INDEX "products_catalog_identity_key"
  ON "products"("catalogIdentityKey")
  WHERE "venueId" IS NULL AND "type" = 'INGREDIENT' AND "catalogIdentityKey" IS NOT NULL;
CREATE INDEX "products_venue_type_status_name_idx"
  ON "products"("venueId", "type", "status", "nameNormalized");
CREATE UNIQUE INDEX "units_system_code_key" ON "units"("code") WHERE "venueId" IS NULL;
CREATE UNIQUE INDEX "units_venue_code_key" ON "units"("venueId", "code") WHERE "venueId" IS NOT NULL;
CREATE INDEX "units_venue_label_idx" ON "units"("venueId", "label");
CREATE UNIQUE INDEX "reference_values_system_key" ON "reference_values"("type", "code") WHERE "venueId" IS NULL;
CREATE UNIQUE INDEX "reference_values_venue_key" ON "reference_values"("venueId", "type", "code") WHERE "venueId" IS NOT NULL;
CREATE INDEX "reference_values_scope_type_sort_idx" ON "reference_values"("venueId", "type", "sortOrder");
CREATE INDEX "ingredient_categories_parent_sort_idx" ON "ingredient_categories"("parentCode", "sortOrder");
CREATE INDEX "preparation_categories_sort_idx" ON "preparation_categories"("sortOrder");
CREATE INDEX "product_components_parent_idx" ON "product_components"("parentVenueId", "parentProductId");
CREATE INDEX "product_components_component_idx" ON "product_components"("componentProductId");
CREATE INDEX "product_aliases_product_idx" ON "product_aliases"("productId");

CREATE FUNCTION enforce_product_component_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_type "ProductType";
  component_type "ProductType";
  component_venue UUID;
  unit_venue UUID;
BEGIN
  SELECT "type" INTO parent_type FROM "products"
    WHERE "id" = NEW."parentProductId" AND "venueId" = NEW."parentVenueId";
  SELECT "type", "venueId" INTO component_type, component_venue FROM "products"
    WHERE "id" = NEW."componentProductId";
  SELECT "venueId" INTO unit_venue FROM "units" WHERE "id" = NEW."unitId";

  IF parent_type IS NULL OR parent_type = 'INGREDIENT' THEN
    RAISE EXCEPTION 'Product component parent must be a local composite product';
  END IF;
  IF component_type IS NULL OR component_venue IS DISTINCT FROM NEW."componentVenueId" THEN
    RAISE EXCEPTION 'Product component tenant does not match referenced product';
  END IF;
  IF component_venue IS NOT NULL AND component_venue <> NEW."parentVenueId" THEN
    RAISE EXCEPTION 'Products from different venues cannot be linked';
  END IF;
  IF component_venue IS NULL AND component_type <> 'INGREDIENT' THEN
    RAISE EXCEPTION 'Only global ingredients may be used across venues';
  END IF;
  IF unit_venue IS NOT NULL AND unit_venue <> NEW."parentVenueId" THEN
    RAISE EXCEPTION 'A unit from another venue cannot be used';
  END IF;
  IF parent_type = 'PREPARATION' AND component_type NOT IN ('INGREDIENT', 'PREPARATION') THEN
    RAISE EXCEPTION 'Invalid preparation component type';
  END IF;
  IF parent_type IN ('GARNISH', 'COCKTAIL') AND component_type NOT IN ('INGREDIENT', 'PREPARATION') THEN
    RAISE EXCEPTION 'Invalid recipe component type';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "product_components_scope_trigger"
  BEFORE INSERT OR UPDATE ON "product_components"
  FOR EACH ROW EXECUTE FUNCTION enforce_product_component_scope();

CREATE FUNCTION enforce_cocktail_garnish_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cocktail_type "ProductType";
  garnish_type "ProductType";
BEGIN
  SELECT "type" INTO cocktail_type FROM "products"
    WHERE "id" = NEW."cocktailId" AND "venueId" = NEW."cocktailVenueId";
  SELECT "type" INTO garnish_type FROM "products"
    WHERE "id" = NEW."garnishId" AND "venueId" = NEW."garnishVenueId";
  IF cocktail_type <> 'COCKTAIL' OR garnish_type <> 'GARNISH' THEN
    RAISE EXCEPTION 'Cocktail garnishes must link a cocktail to a garnish';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "cocktail_garnishes_scope_trigger"
  BEFORE INSERT OR UPDATE ON "cocktail_garnishes"
  FOR EACH ROW EXECUTE FUNCTION enforce_cocktail_garnish_scope();

CREATE FUNCTION enforce_product_category_depth() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_parent_code TEXT;
BEGIN
  IF NEW."parentCode" IS NOT NULL THEN
    SELECT "parentCode" INTO parent_parent_code FROM "ingredient_categories" WHERE "code" = NEW."parentCode";
    IF parent_parent_code IS NOT NULL THEN
      RAISE EXCEPTION 'Ingredient categories support at most two levels';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ingredient_categories_depth_trigger"
  BEFORE INSERT OR UPDATE OF "parentCode" ON "ingredient_categories"
  FOR EACH ROW EXECUTE FUNCTION enforce_product_category_depth();
