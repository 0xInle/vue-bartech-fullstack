import { Inject, Injectable } from "@nestjs/common";
import {
  DATABASE_CLIENT,
  Prisma,
  type PrismaClient,
  type QuantityKind,
  type ReferenceValueType,
} from "@bartech/database";

type ProductDatabase = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class ProductsRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: PrismaClient) {}

  get databaseClient(): PrismaClient {
    return this.database;
  }

  async getReferences(venueId: string) {
    const [ingredientCategories, preparationCategories, units, referenceValues] = await Promise.all(
      [
        this.database.ingredientCategory.findMany({
          where: { isActive: true },
          orderBy: [{ parentCode: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            code: true,
            name: true,
            parentCode: true,
            sortOrder: true,
            isActive: true,
          },
        }),
        this.database.preparationCategory.findMany({
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, code: true, name: true, sortOrder: true, isActive: true },
        }),
        this.database.unit.findMany({
          where: { OR: [{ venueId: null }, { venueId }] },
          orderBy: [{ venueId: "asc" }, { label: "asc" }],
          select: { id: true, code: true, label: true, kind: true, venueId: true },
        }),
        this.database.referenceValue.findMany({
          where: { isActive: true, OR: [{ venueId: null }, { venueId }] },
          orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
          select: {
            id: true,
            type: true,
            code: true,
            label: true,
            venueId: true,
            sortOrder: true,
            isActive: true,
          },
        }),
      ],
    );

    return { ingredientCategories, preparationCategories, units, referenceValues };
  }

  findIngredientCategory(database: ProductDatabase, code: string) {
    return database.ingredientCategory.findFirst({ where: { code, isActive: true } });
  }

  findAnyIngredientCategory(database: ProductDatabase, code: string) {
    return database.ingredientCategory.findUnique({ where: { code } });
  }

  lockIngredientCategoryTree(transaction: Prisma.TransactionClient) {
    return transaction.$queryRaw<Array<{ pg_advisory_xact_lock: null }>>`
      SELECT pg_advisory_xact_lock(hashtextextended('ingredient-category-tree', 0))
    `;
  }

  findPreparationCategory(database: ProductDatabase, code: string) {
    return database.preparationCategory.findFirst({ where: { code, isActive: true } });
  }

  findAllowedProducts(database: ProductDatabase, venueId: string, ids: string[]) {
    return database.product.findMany({
      where: {
        id: { in: ids },
        OR: [{ venueId }, { venueId: null, type: "INGREDIENT" }],
        status: "ACTIVE",
      },
      select: { id: true, type: true, venueId: true },
    });
  }

  findActiveCocktail(database: ProductDatabase, venueId: string, cocktailId: string) {
    return database.product.findFirst({
      where: { id: cocktailId, venueId, type: "COCKTAIL", status: "ACTIVE" },
      select: { id: true },
    });
  }

  findAllowedUnits(database: ProductDatabase, venueId: string, ids: string[]) {
    return database.unit.findMany({
      where: { id: { in: ids }, OR: [{ venueId }, { venueId: null }] },
      select: { id: true, venueId: true },
    });
  }

  findUnitByCode(database: ProductDatabase, venueId: string, code: string) {
    return database.unit.findFirst({
      where: { code, OR: [{ venueId: null }, { venueId }] },
      select: { id: true },
    });
  }

  findReferenceValueByCode(
    database: ProductDatabase,
    venueId: string,
    type: ReferenceValueType,
    code: string,
  ) {
    return database.referenceValue.findFirst({
      where: { type, code, OR: [{ venueId: null }, { venueId }] },
      select: { id: true },
    });
  }

  findAvailableReferenceValueById(
    database: ProductDatabase,
    venueId: string,
    type: ReferenceValueType,
    id: string,
  ) {
    return database.referenceValue.findFirst({
      where: { id, type, isActive: true, OR: [{ venueId: null }, { venueId }] },
      select: { id: true },
    });
  }

  findPreparationEdges(database: ProductDatabase, venueId: string) {
    return database.productComponent.findMany({
      where: { parentProduct: { venueId, type: "PREPARATION" } },
      select: { parentProductId: true, componentProductId: true },
    });
  }

  lockPreparationGraph(transaction: Prisma.TransactionClient, venueId: string) {
    return transaction.$queryRaw<Array<{ pg_advisory_xact_lock: null }>>`
      SELECT pg_advisory_xact_lock(hashtextextended(${venueId}, 0))
    `;
  }

  createLocalIngredient(
    database: ProductDatabase,
    input: {
      id: string;
      venueId: string;
      userId: string | null;
      name: string;
      nameNormalized: string;
      searchNameNormalized: string;
      categoryCode: string;
      brand?: string;
      brandNormalized?: string;
      searchBrandNormalized?: string;
      searchAttributesNormalized: string;
      strength?: number;
      country?: string;
      externalIdentifier?: string;
    },
  ) {
    return database.product.create({
      data: {
        id: input.id,
        type: "INGREDIENT",
        venueId: input.venueId,
        name: input.name,
        nameNormalized: input.nameNormalized,
        searchNameNormalized: input.searchNameNormalized,
        createdByUserId: input.userId,
        updatedByUserId: input.userId,
        ingredient: {
          create: {
            categoryCode: input.categoryCode,
            brand: input.brand,
            brandNormalized: input.brandNormalized,
            searchBrandNormalized: input.searchBrandNormalized,
            searchAttributesNormalized: input.searchAttributesNormalized,
            strength: input.strength,
            country: input.country,
            externalIdentifier: input.externalIdentifier,
          },
        },
      },
      select: { id: true, type: true, name: true, venueId: true },
    });
  }

  createComposite(
    database: ProductDatabase,
    input: {
      id: string;
      venueId: string;
      userId: string | null;
      type: "PREPARATION" | "GARNISH" | "COCKTAIL";
      name: string;
      nameNormalized: string;
      searchNameNormalized: string;
      searchTechnologyNormalized: string;
      technology: string;
      comment?: string;
      output?: { amount: number; unitId: string };
      categoryCode?: string;
      cocktailDetails?: { glassId?: string; iceId?: string; preparationMethodId?: string };
      components: Array<{
        productId: string;
        productVenueId: string | null;
        unitId: string;
        amount: number;
        position: number;
      }>;
      garnishIds?: string[];
    },
  ) {
    return database.product.create({
      data: {
        id: input.id,
        type: input.type,
        venueId: input.venueId,
        name: input.name,
        nameNormalized: input.nameNormalized,
        searchNameNormalized: input.searchNameNormalized,
        searchTechnologyNormalized: input.searchTechnologyNormalized,
        technology: input.technology,
        comment: input.comment,
        outputAmount: input.output?.amount,
        outputUnitId: input.output?.unitId,
        createdByUserId: input.userId,
        updatedByUserId: input.userId,
        preparation:
          input.type === "PREPARATION"
            ? { create: { categoryCode: input.categoryCode! } }
            : undefined,
        cocktail: input.type === "COCKTAIL" ? { create: input.cocktailDetails } : undefined,
        parentComponents: {
          create: input.components.map((component) => ({
            parentVenueId: input.venueId,
            componentProductId: component.productId,
            componentVenueId: component.productVenueId,
            unitId: component.unitId,
            amount: component.amount,
            position: component.position,
          })),
        },
        cocktailGarnishes:
          input.type === "COCKTAIL" && input.garnishIds?.length
            ? {
                create: input.garnishIds.map((garnishId, position) => ({
                  cocktailVenueId: input.venueId,
                  garnishId,
                  garnishVenueId: input.venueId,
                  position,
                })),
              }
            : undefined,
      },
      select: { id: true, type: true, name: true, venueId: true },
    });
  }

  replaceCocktail(
    transaction: Prisma.TransactionClient,
    input: {
      id: string;
      venueId: string;
      userId: string | null;
      name: string;
      nameNormalized: string;
      searchNameNormalized: string;
      searchTechnologyNormalized: string;
      technology: string;
      comment?: string;
      output?: { amount: number; unitId: string };
      cocktailDetails: { glassId: string; iceId: string; preparationMethodId: string };
      components: Array<{
        productId: string;
        productVenueId: string | null;
        unitId: string;
        amount: number;
        position: number;
      }>;
      garnishIds: string[];
    },
  ) {
    return transaction.product.update({
      where: { id: input.id },
      data: {
        name: input.name,
        nameNormalized: input.nameNormalized,
        searchNameNormalized: input.searchNameNormalized,
        searchTechnologyNormalized: input.searchTechnologyNormalized,
        technology: input.technology,
        comment: input.comment,
        outputAmount: input.output?.amount,
        outputUnitId: input.output?.unitId,
        updatedByUserId: input.userId,
        cocktail: { update: input.cocktailDetails },
        parentComponents: {
          deleteMany: { parentProductId: input.id, parentVenueId: input.venueId },
          create: input.components.map((component) => ({
            parentVenueId: input.venueId,
            componentProductId: component.productId,
            componentVenueId: component.productVenueId,
            unitId: component.unitId,
            amount: component.amount,
            position: component.position,
          })),
        },
        cocktailGarnishes: {
          deleteMany: { cocktailId: input.id, cocktailVenueId: input.venueId },
          create: input.garnishIds.map((garnishId, position) => ({
            cocktailVenueId: input.venueId,
            garnishId,
            garnishVenueId: input.venueId,
            position,
          })),
        },
      },
      select: { id: true, type: true, name: true, venueId: true },
    });
  }

  createLocalUnit(
    database: ProductDatabase,
    input: {
      venueId: string;
      userId: string | null;
      code: string;
      label: string;
      kind?: QuantityKind;
    },
  ) {
    return database.unit.create({
      data: {
        venueId: input.venueId,
        createdByUserId: input.userId,
        code: input.code,
        label: input.label,
        kind: input.kind,
      },
      select: { id: true, code: true, label: true, kind: true, venueId: true },
    });
  }

  createLocalReferenceValue(
    database: ProductDatabase,
    input: {
      venueId: string;
      userId: string | null;
      type: ReferenceValueType;
      code: string;
      label: string;
    },
  ) {
    return database.referenceValue.create({
      data: {
        venueId: input.venueId,
        createdByUserId: input.userId,
        type: input.type,
        code: input.code,
        label: input.label,
      },
      select: { id: true, type: true, code: true, label: true, venueId: true },
    });
  }

  findLocalIngredient(database: ProductDatabase, venueId: string, productId: string) {
    return database.product.findFirst({
      where: { id: productId, venueId, type: "INGREDIENT", status: "ACTIVE" },
      select: {
        id: true,
        type: true,
        name: true,
        venueId: true,
        ingredient: {
          select: {
            categoryCode: true,
            brand: true,
            strength: true,
            country: true,
            externalIdentifier: true,
            category: true,
          },
        },
      },
    });
  }

  updateLocalIngredient(
    transaction: Prisma.TransactionClient,
    input: {
      id: string;
      venueId: string;
      userId: string | null;
      name: string;
      nameNormalized: string;
      searchNameNormalized: string;
      categoryCode: string;
      brand?: string;
      brandNormalized?: string;
      searchBrandNormalized?: string;
      searchAttributesNormalized: string;
      strength?: number;
      country?: string;
      externalIdentifier?: string;
    },
  ) {
    return transaction.product.update({
      where: { id: input.id },
      data: {
        name: input.name,
        nameNormalized: input.nameNormalized,
        searchNameNormalized: input.searchNameNormalized,
        updatedByUserId: input.userId,
        ingredient: {
          update: {
            categoryCode: input.categoryCode,
            brand: input.brand,
            brandNormalized: input.brandNormalized,
            searchBrandNormalized: input.searchBrandNormalized,
            searchAttributesNormalized: input.searchAttributesNormalized,
            strength: input.strength,
            country: input.country,
            externalIdentifier: input.externalIdentifier,
          },
        },
      },
      select: { id: true, type: true, name: true, venueId: true },
    });
  }
}
