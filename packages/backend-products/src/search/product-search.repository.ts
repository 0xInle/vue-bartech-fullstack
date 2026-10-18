import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, Prisma, type PrismaClient } from "@bartech/database";

export type ProductSearchScope = "COMPONENT" | "WORKSPACE";
export type ProductSearchItem = {
  id: string;
  type: string;
  name: string;
  venueId: string | null;
  scope: "GLOBAL" | "VENUE";
  venueName: string | null;
  matchReason: string;
  brand: string | null;
  categoryCode: string | null;
  strength: number | null;
};

type ProductSearchInput = {
  venueId?: string;
  companyId?: string;
  scope: ProductSearchScope;
  types: string[];
  variants: string[];
  allowFuzzy: boolean;
  brand?: string;
  categoryCode?: string;
};

type SearchCategory = { type: "INGREDIENT" | "PREPARATION"; code: string; name: string };

@Injectable()
export class ProductSearchRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: PrismaClient) {}

  async findWorkspaceMatches(input: {
    venueId: string;
    type: "COCKTAIL" | "PREPARATION" | "GARNISH";
    variants: string[];
    allowFuzzy: boolean;
  }): Promise<string[]> {
    const rows = await this.database.$queryRaw<{ id: string }[]>(Prisma.sql`
      ${buildRankedSearchCte({ ...input, scope: "WORKSPACE", types: [input.type] })}
      SELECT id FROM ranked ORDER BY match_rank ASC, score DESC, name ASC, id ASC
    `);
    return rows.map(({ id }) => id);
  }

  search(input: ProductSearchInput): Promise<ProductSearchItem[]> {
    return this.database.$queryRaw<ProductSearchItem[]>(Prisma.sql`
      ${buildRankedSearchCte(input)}
      SELECT
        id,
        type,
        name,
        "venueId",
        "venueName",
        scope,
        CASE
          WHEN exact_name THEN 'EXACT_NAME'
          WHEN exact_alias THEN 'CONFIRMED_ALIAS'
          WHEN name_prefix THEN 'PREFIX'
          WHEN name_substring THEN 'PREFIX'
          WHEN name_text_match OR name_fuzzy_match THEN 'FUZZY_NAME'
          ELSE 'ATTRIBUTE_MATCH'
        END AS "matchReason",
        brand,
        "categoryCode",
        strength
      FROM ranked
      ORDER BY match_rank ASC, score DESC, name ASC, id ASC
      LIMIT 20
    `);
  }

  async searchPage(input: {
    venueId?: string;
    companyId?: string;
    types: string[];
    variants: string[];
    allowFuzzy: boolean;
    offset: number;
    limit: number;
    categoryType?: "INGREDIENT" | "PREPARATION";
    categoryCode?: string;
  }): Promise<{ items: ProductSearchItem[]; totalRecords: number; categories: SearchCategory[] }> {
    const searchInput: ProductSearchInput = {
      venueId: input.venueId,
      companyId: input.companyId,
      scope: "WORKSPACE",
      types: input.types,
      variants: input.variants,
      allowFuzzy: input.allowFuzzy,
    };
    const [page] = await this.database.$queryRaw<
      { items: ProductSearchItem[]; totalRecords: number; categories: SearchCategory[] }[]
    >(Prisma.sql`
      ${buildRankedSearchCte(searchInput)},
      filtered AS (
        SELECT ranked.*, preparation_details."categoryCode" AS "preparationCategoryCode"
        FROM ranked
        LEFT JOIN preparation_details ON preparation_details."productId" = ranked.id
        WHERE ${
          input.categoryCode === undefined
            ? Prisma.sql`TRUE`
            : Prisma.sql`(
              (ranked.type = 'INGREDIENT' AND ${input.categoryType} = 'INGREDIENT'
                AND ranked."categoryCode" = ${input.categoryCode})
              OR (ranked.type = 'PREPARATION' AND ${input.categoryType} = 'PREPARATION'
                AND preparation_details."categoryCode" = ${input.categoryCode})
            )`
        }
      ),
      category_facets AS (
        SELECT 'INGREDIENT'::text AS type, ingredient_categories.code, ingredient_categories.name
        FROM ranked
        JOIN ingredient_details ON ingredient_details."productId" = ranked.id
        JOIN ingredient_categories ON ingredient_categories.code = ingredient_details."categoryCode"
        WHERE ranked.type = 'INGREDIENT'
        GROUP BY ingredient_categories.code, ingredient_categories.name
        UNION ALL
        SELECT 'PREPARATION'::text AS type, preparation_categories.code, preparation_categories.name
        FROM ranked
        JOIN preparation_details ON preparation_details."productId" = ranked.id
        JOIN preparation_categories ON preparation_categories.code = preparation_details."categoryCode"
        WHERE ranked.type = 'PREPARATION'
        GROUP BY preparation_categories.code, preparation_categories.name
      ),
      paged AS (
        SELECT *
        FROM filtered
        ORDER BY match_rank ASC, score DESC, name ASC, id ASC
        OFFSET ${input.offset}
        LIMIT ${input.limit}
      )
      SELECT
        COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object(
              'id', id,
              'type', type,
              'name', name,
              'venueId', "venueId",
              'venueName', "venueName",
              'scope', scope,
              'matchReason', CASE
                WHEN exact_name THEN 'EXACT_NAME'
                WHEN exact_alias THEN 'CONFIRMED_ALIAS'
                WHEN name_prefix THEN 'PREFIX'
                WHEN name_substring THEN 'PREFIX'
                WHEN name_text_match OR name_fuzzy_match THEN 'FUZZY_NAME'
                ELSE 'ATTRIBUTE_MATCH'
              END,
              'brand', brand,
              'categoryCode', "categoryCode",
              'strength', strength
            ) ORDER BY match_rank ASC, score DESC, name ASC, id ASC
          ) FROM paged),
          '[]'::jsonb
        ) AS items,
        (SELECT count(*)::int FROM filtered) AS "totalRecords",
        COALESCE(
          (SELECT jsonb_agg(
            jsonb_build_object('type', type, 'code', code, 'name', name)
            ORDER BY name ASC, type ASC
          ) FROM category_facets),
          '[]'::jsonb
        ) AS categories
    `);
    return page;
  }
}

function buildRankedSearchCte(input: ProductSearchInput): Prisma.Sql {
  const prefixVariants = input.variants.map((variant) => `${escapeLikePattern(variant)}%`);
  const substringVariants = input.variants.map((variant) => `%${escapeLikePattern(variant)}%`);
  const workspaceSearch = input.scope === "WORKSPACE";
  const parentVenuePredicate = input.companyId
    ? Prisma.sql`pc."parentVenueId" IN (
        SELECT id FROM venues WHERE "companyId" = ${input.companyId}::uuid AND status = 'ACTIVE'
      )`
    : Prisma.sql`pc."parentVenueId" = ${input.venueId!}::uuid`;
  const localProductPredicate = input.companyId
    ? Prisma.sql`p."venueId" IN (
        SELECT id FROM venues WHERE "companyId" = ${input.companyId}::uuid AND status = 'ACTIVE'
      )`
    : Prisma.sql`p."venueId" = ${input.venueId!}::uuid`;

  return Prisma.sql`
    WITH search_settings AS MATERIALIZED (
      SELECT set_config('pg_trgm.word_similarity_threshold', '0.45', true)
    ),
    query_variants AS (
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
        AND ${parentVenuePredicate}
        AND (pc."componentVenueId" IS NULL OR pc."componentVenueId" = pc."parentVenueId")
        AND c.status = 'ACTIVE'
        AND (
          c."searchNameNormalized" = ANY(${input.variants}::text[])
          OR c."searchNameNormalized" LIKE ANY(${prefixVariants}::text[])
          OR c."searchNameNormalized" LIKE ANY(${substringVariants}::text[])
          OR EXISTS (
            SELECT 1 FROM query_variants qv
            WHERE to_tsvector('simple', c."searchNameNormalized") @@ plainto_tsquery('simple', qv.value)
          )
          OR (${input.allowFuzzy} AND EXISTS (
            SELECT 1 FROM query_variants qv WHERE qv.value <% c."searchNameNormalized"
          ))
          OR EXISTS (
            SELECT 1 FROM product_aliases ca
            WHERE ca."productId" = c.id AND ca."isConfirmed"
              AND (ca."searchValueNormalized" = ANY(${input.variants}::text[])
                OR ca."searchValueNormalized" LIKE ANY(${substringVariants}::text[])
                OR EXISTS (
                  SELECT 1 FROM query_variants qv
                  WHERE to_tsvector('simple', ca."searchValueNormalized") @@ plainto_tsquery('simple', qv.value)
                )
                OR (${input.allowFuzzy} AND EXISTS (
                  SELECT 1 FROM query_variants qv WHERE qv.value <% ca."searchValueNormalized"
                )))
          )
          OR EXISTS (
            SELECT 1 FROM query_variants qv
            WHERE to_tsvector('simple', ci."searchAttributesNormalized") @@ plainto_tsquery('simple', qv.value)
          )
          OR (${input.allowFuzzy} AND EXISTS (
            SELECT 1 FROM query_variants qv WHERE qv.value <% ci."searchAttributesNormalized"
          ))
        )
    ),
    signals AS (
      SELECT
        p.id,
        p.type::text AS type,
        p.name,
        p."venueId",
        v.name AS "venueName",
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
        (p."searchNameNormalized" LIKE ANY(${prefixVariants}::text[]) OR EXISTS (
          SELECT 1 FROM product_aliases a
          WHERE a."productId" = p.id AND a."isConfirmed"
            AND a."searchValueNormalized" LIKE ANY(${prefixVariants}::text[])
        )) AS name_prefix,
        (p."searchNameNormalized" LIKE ANY(${substringVariants}::text[]) OR EXISTS (
          SELECT 1 FROM product_aliases a
          WHERE a."productId" = p.id AND a."isConfirmed"
            AND a."searchValueNormalized" LIKE ANY(${substringVariants}::text[])
        )) AS name_substring,
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
            SELECT 1 FROM query_variants qv WHERE qv.value <% p."searchNameNormalized"
          )
          OR EXISTS (
            SELECT 1 FROM product_aliases a
            WHERE a."productId" = p.id AND a."isConfirmed"
              AND EXISTS (
                SELECT 1 FROM query_variants qv WHERE qv.value <% a."searchValueNormalized"
              )
          ))) AS name_fuzzy_match,
        (${workspaceSearch} AND p."searchTechnologyNormalized" IS NOT NULL AND (
          EXISTS (
            SELECT 1 FROM query_variants qv
            WHERE to_tsvector('simple', p."searchTechnologyNormalized") @@ plainto_tsquery('simple', qv.value)
          )
          OR (${input.allowFuzzy} AND EXISTS (
            SELECT 1 FROM query_variants qv WHERE qv.value <% p."searchTechnologyNormalized"
          ))
        )) AS technology_match,
        (${workspaceSearch} AND EXISTS (
          SELECT 1 FROM component_matches cm WHERE cm."parentProductId" = p.id
        )) AS component_match,
        (i."searchAttributesNormalized" = ANY(${input.variants}::text[])
          OR i."searchAttributesNormalized" LIKE ANY(${prefixVariants}::text[])
          OR i."searchAttributesNormalized" LIKE ANY(${substringVariants}::text[])
          OR lower(ingredient_categories.name) = ANY(${input.variants}::text[])
          OR lower(ingredient_categories.name) LIKE ANY(${prefixVariants}::text[])
          OR lower(ingredient_categories.name) LIKE ANY(${substringVariants}::text[])
          OR EXISTS (
            SELECT 1 FROM query_variants qv
            WHERE to_tsvector('simple', i."searchAttributesNormalized") @@ plainto_tsquery('simple', qv.value)
          )
          OR EXISTS (
            SELECT 1 FROM query_variants qv
            WHERE to_tsvector('simple', lower(ingredient_categories.name)) @@ plainto_tsquery('simple', qv.value)
          )
          OR (${input.allowFuzzy} AND EXISTS (
            SELECT 1 FROM query_variants qv WHERE qv.value <% i."searchAttributesNormalized"
          ))
          OR (${input.brand ?? null}::text IS NOT NULL AND i."searchBrandNormalized" = ${input.brand ?? null})
          OR (${input.categoryCode ?? null}::text IS NOT NULL AND i."categoryCode" = ${input.categoryCode ?? null})
          OR lower(i."externalIdentifier") = ANY(${input.variants}::text[])
        ) AS attribute_match,
        GREATEST(
          COALESCE((SELECT max(word_similarity(qv.value, p."searchNameNormalized")) FROM query_variants qv), 0),
          COALESCE((SELECT max(word_similarity(qv.value, a."searchValueNormalized"))
            FROM product_aliases a CROSS JOIN query_variants qv
            WHERE a."productId" = p.id AND a."isConfirmed"), 0),
          COALESCE((SELECT max(word_similarity(qv.value, p."searchTechnologyNormalized"))
            FROM query_variants qv), 0),
          COALESCE((SELECT max(word_similarity(qv.value, i."searchAttributesNormalized"))
            FROM query_variants qv), 0)
        ) AS score
      FROM products p
      CROSS JOIN search_settings
      LEFT JOIN venues v ON v.id = p."venueId"
      LEFT JOIN ingredient_details i ON i."productId" = p.id
      LEFT JOIN ingredient_categories ON ingredient_categories.code = i."categoryCode"
      WHERE p.status = 'ACTIVE'
        AND ((p."venueId" IS NULL AND p.type = 'INGREDIENT' AND 'INGREDIENT' = ANY(${input.types}::text[])) OR
          (${localProductPredicate} AND p.type::text = ANY(${input.types}::text[])))
    ),
    ranked AS (
      SELECT *, CASE
        WHEN exact_name THEN 1
        WHEN exact_alias THEN 2
        WHEN name_prefix THEN 3
        WHEN name_substring THEN 4
        WHEN name_text_match THEN 5
        WHEN name_fuzzy_match THEN 6
        WHEN technology_match THEN 7
        WHEN component_match THEN 8
        ELSE 9
      END AS match_rank
      FROM signals
      WHERE exact_name OR exact_alias OR name_prefix OR name_substring OR name_text_match OR name_fuzzy_match
        OR technology_match OR component_match OR attribute_match
    )
  `;
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/gu, "\\$&");
}
