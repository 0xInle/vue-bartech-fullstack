import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DATABASE_CLIENT, Prisma, type PrismaClient } from "@bartech/database";
import type { GlobalIngredientInput } from "./catalog-review.dto.js";

type Database = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class CatalogReviewRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: PrismaClient) {}

  listCandidates(offset: number, limit: number) {
    return this.database.catalogMatchRequest.findMany({
      where: {
        status: "NEEDS_REVIEW",
        localProduct: { is: { status: "ACTIVE" } },
      },
      orderBy: [{ processedAt: "asc" }, { id: "asc" }],
      skip: offset,
      take: limit + 1,
      select: candidateSelect,
    });
  }

  async getCandidate(id: string) {
    return this.database.catalogMatchRequest.findFirst({
      where: {
        id,
        status: "NEEDS_REVIEW",
        localProduct: { is: { status: "ACTIVE" } },
      },
      select: candidateSelect,
    });
  }

  async searchGlobalIngredients(query: string, offset: number, limit: number) {
    const normalized = normalizeSearchValue(query);
    return this.database.product.findMany({
      where: {
        type: "INGREDIENT",
        status: "ACTIVE",
        venueId: null,
        OR: [
          { searchNameNormalized: { contains: normalized } },
          {
            aliases: {
              some: { isConfirmed: true, searchValueNormalized: { contains: normalized } },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        ingredient: { select: { categoryCode: true, brand: true, strength: true, country: true } },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: offset,
      take: limit,
    });
  }

  listCategories() {
    return this.database.ingredientCategory.findMany({
      where: { isActive: true },
      select: { code: true, name: true },
      orderBy: [{ parentCode: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });
  }

  transaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
    return this.database.$transaction(operation);
  }

  async lockVenue(transaction: Prisma.TransactionClient, venueId: string) {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${venueId}, 0))`;
  }

  async lockLocalProduct(transaction: Prisma.TransactionClient, localProductId: string) {
    await transaction.$queryRaw`SELECT id FROM products WHERE id = ${localProductId}::uuid FOR UPDATE`;
  }

  findCandidate(transaction: Database, id: string) {
    return transaction.catalogMatchRequest.findFirst({
      where: {
        id,
        status: "NEEDS_REVIEW",
        localProduct: { is: { status: "ACTIVE" } },
      },
      select: {
        id: true,
        status: true,
        localProduct: {
          select: {
            id: true,
            venueId: true,
            name: true,
            status: true,
            updatedAt: true,
            ingredient: {
              select: {
                categoryCode: true,
                brand: true,
                strength: true,
                country: true,
                externalIdentifier: true,
              },
            },
          },
        },
      },
    });
  }

  findGlobalIngredient(transaction: Database, id: string) {
    return transaction.product.findFirst({
      where: {
        id,
        type: "INGREDIENT",
        status: "ACTIVE",
        venueId: null,
        ingredient: { isNot: null },
      },
      include: { ingredient: true },
    });
  }

  findCategory(transaction: Database, code: string) {
    return transaction.ingredientCategory.findFirst({ where: { code, isActive: true } });
  }

  lockCategoryTree(transaction: Prisma.TransactionClient) {
    return transaction.$queryRaw<Array<{ pg_advisory_xact_lock: null }>>`
      SELECT pg_advisory_xact_lock(hashtextextended('ingredient-category-tree', 0))
    `;
  }

  async createGlobalIngredient(
    transaction: Prisma.TransactionClient,
    input: GlobalIngredientInput,
  ) {
    const id = randomUUID();
    const name = input.name.trim().replace(/\s+/gu, " ");
    const brand = input.brand?.trim() || null;
    const country = input.country?.trim() || null;
    const externalIdentifier = input.externalIdentifier?.trim() || null;
    return transaction.product.create({
      data: {
        id,
        type: "INGREDIENT",
        name,
        nameNormalized: normalize(name),
        searchNameNormalized: normalizeSearchValue(name),
        catalogIdentityKey: catalogIdentityKey({
          name,
          brand,
          strength: input.strength ?? null,
          country,
          externalIdentifier,
        }),
        createdByUserId: null,
        updatedByUserId: null,
        ingredient: {
          create: {
            categoryCode: input.categoryCode,
            brand,
            brandNormalized: brand ? normalize(brand) : null,
            searchBrandNormalized: brand ? normalizeSearchValue(brand) : null,
            strength: input.strength,
            country,
            externalIdentifier,
            searchAttributesNormalized: normalizeSearchValue(
              [input.categoryCode, brand, input.strength, country, externalIdentifier]
                .filter((value) => value !== null && value !== undefined)
                .join(" "),
            ),
          },
        },
      },
      include: { ingredient: true },
    });
  }

  replaceVenueReferences(
    transaction: Prisma.TransactionClient,
    venueId: string,
    localId: string,
    globalId: string,
  ) {
    return transaction.productComponent.updateMany({
      where: { parentVenueId: venueId, componentVenueId: venueId, componentProductId: localId },
      data: { componentProductId: globalId, componentVenueId: null },
    });
  }

  async deleteLocalAndCandidate(
    transaction: Prisma.TransactionClient,
    localId: string,
    candidateId: string,
  ) {
    await transaction.catalogMatchRequest.delete({ where: { id: candidateId } });
    await transaction.product.delete({ where: { id: localId } });
  }

  async resolveLocal(transaction: Prisma.TransactionClient, candidateId: string, now: Date) {
    return transaction.catalogMatchRequest.updateMany({
      where: { id: candidateId, status: "NEEDS_REVIEW" },
      data: { status: "RESOLVED", processedAt: now },
    });
  }
}

const candidateSelect = {
  id: true,
  status: true,
  reason: true,
  confidence: true,
  processedAt: true,
  localProduct: {
    select: {
      id: true,
      venueId: true,
      name: true,
      status: true,
      ingredient: {
        select: {
          categoryCode: true,
          brand: true,
          strength: true,
          country: true,
          externalIdentifier: true,
        },
      },
    },
  },
  suggestedGlobalProduct: { select: { id: true, name: true } },
} satisfies Prisma.CatalogMatchRequestSelect;

export function normalize(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

export function normalizeSearchValue(value: string): string {
  return normalize(value).normalize("NFD").replace(/\p{M}/gu, "");
}

export function catalogIdentityKey(input: {
  name: string;
  brand: string | null;
  strength: number | string | { toString(): string } | null;
  country: string | null;
  externalIdentifier: string | null;
}) {
  return [
    normalize(input.name),
    normalize(input.brand ?? ""),
    input.strength === null ? "" : String(input.strength),
    normalize(input.country ?? ""),
    normalize(input.externalIdentifier ?? ""),
  ].join("\u001f");
}
