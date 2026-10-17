import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, Prisma, type PrismaClient } from "@bartech/database";

export type ProductSearchScope = "COMPONENT" | "WORKSPACE";
export type ProductSearchItem = {
  id: string;
  type: string;
  name: string;
  venueId: string | null;
  scope: "GLOBAL" | "VENUE";
  matchReason: string;
  brand: string | null;
  categoryCode: string | null;
  strength: number | null;
};

@Injectable()
export class ProductSearchRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: PrismaClient) {}

  search(input: {
    venueId: string;
    scope: ProductSearchScope;
    types: string[];
    variants: string[];
    allowFuzzy: boolean;
    brand?: string;
    categoryCode?: string;
  }): Promise<ProductSearchItem[]> {
    const prefixVariants = input.variants.map((variant) => `${variant}%`);
    const workspaceSearch = input.scope === "WORKSPACE";

    return this.database.$queryRaw<ProductSearchItem[]>(Prisma.sql`
      WITH query_variants AS (
        SELECT value FROM unnest(${input.variants}::text[]) AS variant(value)
      ),
      component_matches AS (
        SELECT DISTINCT pc."parentProductId"
        FROM product_components pc
        JOIN products c
          ON c.id = pc."componentProductId"
          AND c."venueId" IS NOT DISTINCT FROM pc."componentVenueId"
        LEFT JOIN ingredient_details ci ON ci."productId" = c.id
        WHERE ${workspaceSearch}
          AND pc."parentVenueId" = ${input.venueId}::uuid
          AND (pc."componentVenueId" IS NULL OR pc."componentVenueId" = ${input.venueId}::uuid)
          AND c.status = 'ACTIVE'
          AND (
            c."searchNameNormalized" = ANY(${input.variants}::text[])
            OR c."searchNameNormalized" LIKE ANY(${prefixVariants}::text[])
            OR EXISTS (
              SELECT 1 FROM query_variants qv
              WHERE to_tsvector('simple', c."searchNameNormalized") @@ plainto_tsquery('simple', qv.value)
            )
            OR (${input.allowFuzzy} AND EXISTS (
              SELECT 1 FROM query_variants qv WHERE c."searchNameNormalized" % qv.value
            ))
            OR EXISTS (
              SELECT 1 FROM product_aliases ca
              WHERE ca."productId" = c.id AND ca."isConfirmed"
                AND (ca."searchValueNormalized" = ANY(${input.variants}::text[])
                  OR EXISTS (
                    SELECT 1 FROM query_variants qv
                    WHERE to_tsvector('simple', ca."searchValueNormalized") @@ plainto_tsquery('simple', qv.value)
                  )
                  OR (${input.allowFuzzy} AND EXISTS (
                    SELECT 1 FROM query_variants qv WHERE ca."searchValueNormalized" % qv.value
                  )))
            )
            OR EXISTS (
              SELECT 1 FROM query_variants qv
              WHERE to_tsvector('simple', ci."searchAttributesNormalized") @@ plainto_tsquery('simple', qv.value)
            )
            OR (${input.allowFuzzy} AND EXISTS (
              SELECT 1 FROM query_variants qv WHERE ci."searchAttributesNormalized" % qv.value
            ))
          )
      ),
      signals AS (
        SELECT
          p.id,
          p.type::text AS type,
          p.name,
          p."venueId",
          CASE WHEN p."venueId" IS NULL THEN 'GLOBAL' ELSE 'VENUE' END AS scope,
          i.brand,
          i."categoryCode",
          i.strength::float8 AS strength,
          (p."searchNameNormalized" = ANY(${input.variants}::text[])) AS exact_name,
          EXISTS (
            SELECT 1 FROM product_aliases a
            WHERE a."productId" = p.id AND a."isConfirmed"
              AND a."searchValueNormalized" = ANY(${input.variants}::text[])
          ) AS exact_alias,
          (p."searchNameNormalized" LIKE ANY(${prefixVariants}::text[])) AS name_prefix,
          (EXISTS (
              SELECT 1 FROM query_variants qv
              WHERE to_tsvector('simple', p."searchNameNormalized") @@ plainto_tsquery('simple', qv.value)
            )
            OR EXISTS (
              SELECT 1 FROM product_aliases a
              WHERE a."productId" = p.id AND a."isConfirmed"
                AND EXISTS (
                  SELECT 1 FROM query_variants qv
                  WHERE to_tsvector('simple', a."searchValueNormalized") @@ plainto_tsquery('simple', qv.value)
                )
            )) AS name_text_match,
          (${input.allowFuzzy} AND (EXISTS (
              SELECT 1 FROM query_variants qv WHERE p."searchNameNormalized" % qv.value
            )
            OR EXISTS (
              SELECT 1 FROM product_aliases a
              WHERE a."productId" = p.id AND a."isConfirmed"
                AND EXISTS (
                  SELECT 1 FROM query_variants qv WHERE a."searchValueNormalized" % qv.value
                )
            ))) AS name_fuzzy_match,
          (${workspaceSearch} AND p."searchTechnologyNormalized" IS NOT NULL AND (
            EXISTS (
              SELECT 1 FROM query_variants qv
              WHERE to_tsvector('simple', p."searchTechnologyNormalized") @@ plainto_tsquery('simple', qv.value)
            )
            OR (${input.allowFuzzy} AND EXISTS (
              SELECT 1 FROM query_variants qv WHERE p."searchTechnologyNormalized" % qv.value
            ))
          )) AS technology_match,
          (${workspaceSearch} AND EXISTS (
            SELECT 1 FROM component_matches cm WHERE cm."parentProductId" = p.id
          )) AS component_match,
          (i."searchAttributesNormalized" = ANY(${input.variants}::text[])
            OR i."searchAttributesNormalized" LIKE ANY(${prefixVariants}::text[])
            OR EXISTS (
              SELECT 1 FROM query_variants qv
              WHERE to_tsvector('simple', i."searchAttributesNormalized") @@ plainto_tsquery('simple', qv.value)
            )
            OR (${input.allowFuzzy} AND EXISTS (
              SELECT 1 FROM query_variants qv WHERE i."searchAttributesNormalized" % qv.value
            ))
            OR (${input.brand ?? null}::text IS NOT NULL AND i."searchBrandNormalized" = ${input.brand ?? null})
            OR (${input.categoryCode ?? null}::text IS NOT NULL AND i."categoryCode" = ${input.categoryCode ?? null})
            OR lower(i."externalIdentifier") = ANY(${input.variants}::text[])
          ) AS attribute_match,
          GREATEST(
            COALESCE((SELECT max(similarity(p."searchNameNormalized", qv.value)) FROM query_variants qv), 0),
            COALESCE((SELECT max(similarity(a."searchValueNormalized", qv.value))
              FROM product_aliases a CROSS JOIN query_variants qv
              WHERE a."productId" = p.id AND a."isConfirmed"), 0),
            COALESCE((SELECT max(similarity(p."searchTechnologyNormalized", qv.value))
              FROM query_variants qv), 0),
            COALESCE((SELECT max(similarity(i."searchAttributesNormalized", qv.value))
              FROM query_variants qv), 0)
          ) AS score
        FROM products p
        LEFT JOIN ingredient_details i ON i."productId" = p.id
        WHERE p.status = 'ACTIVE'
          AND ((p."venueId" IS NULL AND p.type = 'INGREDIENT') OR
            (p."venueId" = ${input.venueId}::uuid AND p.type::text = ANY(${input.types}::text[])))
      ),
      ranked AS (
        SELECT *, CASE
          WHEN exact_name THEN 1
          WHEN exact_alias THEN 2
          WHEN name_prefix THEN 3
          WHEN name_text_match THEN 4
          WHEN name_fuzzy_match THEN 5
          WHEN technology_match THEN 6
          WHEN component_match THEN 7
          ELSE 8
        END AS match_rank
        FROM signals
        WHERE exact_name OR exact_alias OR name_prefix OR name_text_match OR name_fuzzy_match
          OR technology_match OR component_match OR attribute_match
      )
      SELECT
        id,
        type,
        name,
        "venueId",
        scope,
        CASE
          WHEN exact_name THEN 'EXACT_NAME'
          WHEN exact_alias THEN 'CONFIRMED_ALIAS'
          WHEN name_prefix THEN 'PREFIX'
          WHEN name_text_match OR name_fuzzy_match THEN 'FUZZY_NAME'
          ELSE 'ATTRIBUTE_MATCH'
        END AS "matchReason",
        brand,
        "categoryCode",
        strength
      FROM ranked
      ORDER BY match_rank ASC, score DESC, name ASC
      LIMIT 20
    `);
  }
}
