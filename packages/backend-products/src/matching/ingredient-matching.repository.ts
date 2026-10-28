import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, Prisma, type PrismaClient } from "@bartech/database";
import type { IngredientMatchReason } from "./ingredient-match-rules.js";

@Injectable()
export class IngredientMatchingRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: PrismaClient) {}

  findLocalIngredientsAfter(id?: string) {
    return this.database.product.findMany({
      where: {
        type: "INGREDIENT",
        status: "ACTIVE",
        venueId: { not: null },
        ...(id ? { id: { gt: id } } : {}),
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take: 100,
    });
  }

  async process(localProductId: string): Promise<void> {
    await this.database.$transaction(async (transaction) => {
      const scope = await transaction.product.findFirst({
        where: { id: localProductId, type: "INGREDIENT", venueId: { not: null } },
        select: { venueId: true },
      });
      if (!scope?.venueId) return;
      await transaction.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_advisory_xact_lock(hashtextextended(${scope.venueId}, 0)) IS NULL AS locked
      `;
      await transaction.$queryRaw`SELECT id FROM products WHERE id = ${localProductId}::uuid FOR UPDATE`;
      const local = await transaction.product.findFirst({
        where: { id: localProductId, type: "INGREDIENT", status: "ACTIVE", venueId: { not: null } },
        include: { ingredient: true },
      });
      if (!local?.ingredient || !local.venueId) return;

      const resolvedRequest = await transaction.catalogMatchRequest.findUnique({
        where: { localProductId: local.id },
        select: { status: true, processedAt: true },
      });
      if (
        resolvedRequest?.status === "RESOLVED" &&
        local.updatedAt.getTime() <= resolvedRequest.processedAt.getTime()
      ) {
        return;
      }

      const ingredient = local.ingredient;
      const candidates = await transaction.product.findMany({
        where: {
          type: "INGREDIENT",
          status: "ACTIVE",
          venueId: null,
          OR: [
            ...(ingredient.externalIdentifier
              ? [{ ingredient: { is: { externalIdentifier: ingredient.externalIdentifier } } }]
              : []),
            ...(ingredient.brandNormalized
              ? [
                  {
                    searchNameNormalized: local.searchNameNormalized,
                    ingredient: {
                      is: {
                        searchBrandNormalized: ingredient.searchBrandNormalized,
                        categoryCode: ingredient.categoryCode,
                      },
                    },
                  },
                ]
              : []),
            {
              aliases: {
                some: { isConfirmed: true, searchValueNormalized: local.searchNameNormalized },
              },
            },
          ],
        },
        include: { ingredient: true, aliases: { where: { isConfirmed: true } } },
      });
      const uniqueCandidates = [
        ...new Map(candidates.map((candidate) => [candidate.id, candidate])).values(),
      ];
      const externalMatches = ingredient.externalIdentifier
        ? uniqueCandidates.filter(
            (candidate) =>
              candidate.ingredient?.externalIdentifier === ingredient.externalIdentifier,
          )
        : [];
      const externalMatchIngredient =
        externalMatches.length === 1 ? externalMatches[0]?.ingredient : null;
      const compatibleExternalMatch =
        externalMatchIngredient &&
        hasCompatibleSpecifiedCharacteristics(
          characteristics(ingredient),
          characteristics(externalMatchIngredient),
        )
          ? externalMatches
          : [];
      const exactMatches = uniqueCandidates.filter(
        (candidate) =>
          candidate.ingredient !== null &&
          candidate.searchNameNormalized === local.searchNameNormalized &&
          candidate.ingredient?.searchBrandNormalized === ingredient.searchBrandNormalized &&
          candidate.ingredient?.categoryCode === ingredient.categoryCode &&
          hasExactStrictCharacteristics(
            characteristics(ingredient),
            characteristics(candidate.ingredient),
          ),
      );
      const aliasMatches = uniqueCandidates.filter(
        (candidate) =>
          candidate.ingredient !== null &&
          candidate.aliases.some(
            (alias) => alias.searchValueNormalized === local.searchNameNormalized,
          ) &&
          hasCompatibleSpecifiedCharacteristics(
            characteristics(ingredient),
            characteristics(candidate.ingredient),
          ),
      );
      const strictMatches = compatibleExternalMatch.length
        ? compatibleExternalMatch
        : exactMatches.length
          ? exactMatches
          : aliasMatches;
      if (strictMatches.length === 1) {
        const candidate = strictMatches[0]!;
        await transaction.productComponent.updateMany({
          where: {
            parentVenueId: local.venueId,
            componentVenueId: local.venueId,
            componentProductId: local.id,
          },
          data: { componentProductId: candidate.id, componentVenueId: null },
        });
        const venue = await transaction.venue.findUnique({
          where: { id: local.venueId },
          select: { companyId: true },
        });
        await transaction.auditEvent.create({
          data: {
            eventType: "PRODUCT_CATALOG_MATCHED",
            actorType: "SYSTEM",
            companyId: venue?.companyId,
            venueId: local.venueId,
            entityType: "PRODUCT",
            entityId: local.id,
            metadata: { localProductId: local.id, globalProductId: candidate.id },
          },
        });
        await transaction.product.delete({ where: { id: local.id } });
        return;
      }

      const fuzzy =
        local.searchNameNormalized.length >= 3
          ? await transaction.$queryRaw<Array<{ id: string; confidence: number }>>(Prisma.sql`
              SELECT p.id, similarity(p."searchNameNormalized", ${local.searchNameNormalized}) AS confidence
              FROM products p
              WHERE p."venueId" IS NULL AND p.type = 'INGREDIENT' AND p.status = 'ACTIVE'
                AND p."searchNameNormalized" % ${local.searchNameNormalized}
              ORDER BY confidence DESC, p.name ASC
              LIMIT 5
            `)
          : [];
      const nameCandidates = uniqueCandidates.filter(
        (candidate) => candidate.searchNameNormalized === local.searchNameNormalized,
      );
      const reason: IngredientMatchReason =
        externalMatches.length > 1 || exactMatches.length > 1 || aliasMatches.length > 1
          ? "MULTIPLE_CANDIDATES"
          : nameCandidates.length
            ? "ATTRIBUTE_CONFLICT"
            : fuzzy.length
              ? "FUZZY_NAME"
              : "NO_CONFIDENT_MATCH";
      const suggestionId = fuzzy[0]?.id ?? nameCandidates[0]?.id ?? null;
      await transaction.catalogMatchRequest.upsert({
        where: { localProductId: local.id },
        create: {
          localProductId: local.id,
          suggestedGlobalProductId: suggestionId,
          status: "NEEDS_REVIEW",
          reason,
          confidence: fuzzy[0]?.confidence ?? null,
          processedAt: new Date(),
        },
        update: {
          suggestedGlobalProductId: suggestionId,
          status: "NEEDS_REVIEW",
          reason,
          confidence: fuzzy[0]?.confidence ?? null,
          processedAt: new Date(),
        },
      });
    });
  }
}

function characteristics(ingredient: {
  categoryCode: string;
  brandNormalized: string | null;
  strength: Prisma.Decimal | null;
  country: string | null;
  externalIdentifier: string | null;
}) {
  return {
    categoryCode: ingredient.categoryCode,
    brandNormalized: ingredient.brandNormalized,
    strength: ingredient.strength?.toNumber() ?? null,
    country: ingredient.country,
    externalIdentifier: ingredient.externalIdentifier,
  };
}

import {
  hasCompatibleSpecifiedCharacteristics,
  hasExactStrictCharacteristics,
} from "./ingredient-match-rules.js";
