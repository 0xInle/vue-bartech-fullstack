import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, Prisma, type PrismaClient } from "@bartech/database";
import { normalizeSearchValue } from "../catalog-review/catalog-review.repository.js";

type Database = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class CatalogManagementRepository {
  constructor(@Inject(DATABASE_CLIENT) readonly database: PrismaClient) {}

  transaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
    return this.database.$transaction(operation);
  }

  list(query: string, status: "ACTIVE" | "ALL", offset: number, limit: number) {
    const normalized = normalizeSearchValue(query);
    return this.database.product.findMany({
      where: {
        type: "INGREDIENT",
        venueId: null,
        ...(status === "ACTIVE" ? { status: "ACTIVE" } : {}),
        ...(normalized
          ? {
              OR: [
                { searchNameNormalized: { contains: normalized } },
                {
                  aliases: {
                    some: {
                      isConfirmed: true,
                      searchValueNormalized: { contains: normalized },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        ingredient: { select: { categoryCode: true, brand: true, strength: true } },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: offset,
      take: limit + 1,
    });
  }

  findCard(database: Database, id: string) {
    return database.product.findFirst({
      where: { id, type: "INGREDIENT", venueId: null, ingredient: { isNot: null } },
      include: {
        ingredient: { include: { category: true } },
        aliases: { orderBy: [{ valueNormalized: "asc" }, { id: "asc" }] },
      },
    });
  }

  findActiveCategory(database: Database, code: string) {
    return database.ingredientCategory.findFirst({ where: { code, isActive: true } });
  }

  findAnyCategory(database: Database, code: string) {
    return database.ingredientCategory.findUnique({ where: { code } });
  }

  lockCategoryTree(transaction: Prisma.TransactionClient) {
    return transaction.$queryRaw<Array<{ pg_advisory_xact_lock: null }>>`
      SELECT pg_advisory_xact_lock(hashtextextended('ingredient-category-tree', 0))
    `;
  }

  async lockCards(transaction: Prisma.TransactionClient, ids: string[]) {
    for (const id of [...ids].sort()) {
      await transaction.$queryRaw`SELECT id FROM products WHERE id = ${id}::uuid FOR UPDATE`;
    }
  }

  findAlias(database: Database, id: string, productId: string) {
    return database.productAlias.findFirst({ where: { id, productId } });
  }

  findAliasOwner(database: Database, normalizedValues: string[], excludedProductIds: string[]) {
    if (!normalizedValues.length) return null;
    return database.productAlias.findFirst({
      where: {
        valueNormalized: { in: normalizedValues },
        productId: { notIn: excludedProductIds },
        product: { type: "INGREDIENT", venueId: null },
      },
      select: { id: true, value: true, product: { select: { id: true, name: true } } },
    });
  }

  findIdentityOwner(database: Database, identityKey: string, excludedProductIds: string[]) {
    return database.product.findFirst({
      where: {
        catalogIdentityKey: identityKey,
        id: { notIn: excludedProductIds },
        type: "INGREDIENT",
        venueId: null,
      },
      select: { id: true, name: true },
    });
  }

  countReferences(database: Database, productId: string) {
    return database.productComponent.count({
      where: { componentProductId: productId, componentVenueId: null },
    });
  }

  moveReferences(transaction: Prisma.TransactionClient, fromId: string, toId: string) {
    return transaction.productComponent.updateMany({
      where: { componentProductId: fromId, componentVenueId: null },
      data: { componentProductId: toId, componentVenueId: null },
    });
  }
}
