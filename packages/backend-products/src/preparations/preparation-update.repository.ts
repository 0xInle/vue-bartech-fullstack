import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, Prisma, type PrismaClient } from "@bartech/database";
import type { PreparationImpactItem } from "./preparation-impact.js";

@Injectable()
export class PreparationUpdateRepository {
  constructor(@Inject(DATABASE_CLIENT) readonly database: PrismaClient) {}

  lockVenue(transaction: Prisma.TransactionClient, venueId: string) {
    return transaction.$queryRaw<Array<{ pg_advisory_xact_lock: null }>>`
      SELECT pg_advisory_xact_lock(hashtextextended(${venueId}, 0))
    `;
  }

  findActive(transaction: Prisma.TransactionClient, venueId: string, preparationId: string) {
    return transaction.product.findFirst({
      where: { id: preparationId, venueId, type: "PREPARATION", status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        technology: true,
        comment: true,
        outputAmount: true,
        outputUnitId: true,
        preparation: { select: { categoryCode: true } },
        parentComponents: {
          orderBy: { position: "asc" },
          select: { componentProductId: true, unitId: true, amount: true },
        },
      },
    });
  }

  findCategory(transaction: Prisma.TransactionClient, categoryCode: string) {
    return transaction.preparationCategory.findFirst({
      where: { code: categoryCode, isActive: true },
      select: { code: true },
    });
  }

  findAllowedProducts(transaction: Prisma.TransactionClient, venueId: string, ids: string[]) {
    return transaction.product.findMany({
      where: {
        id: { in: ids },
        status: "ACTIVE",
        OR: [{ venueId }, { venueId: null, type: "INGREDIENT" }],
      },
      select: { id: true, type: true, venueId: true },
    });
  }

  findAllowedUnits(transaction: Prisma.TransactionClient, venueId: string, ids: string[]) {
    return transaction.unit.findMany({
      where: { id: { in: ids }, OR: [{ venueId }, { venueId: null }] },
      select: { id: true },
    });
  }

  findPreparationEdges(transaction: Prisma.TransactionClient, venueId: string) {
    return transaction.productComponent.findMany({
      where: { parentProduct: { venueId, type: "PREPARATION", status: "ACTIVE" } },
      select: { parentProductId: true, componentProductId: true },
    });
  }

  async findActiveDependents(
    transaction: Prisma.TransactionClient,
    venueId: string,
  ): Promise<Array<PreparationImpactItem & { componentIds: string[]; garnishIds: string[] }>> {
    const products = await transaction.product.findMany({
      where: { venueId, status: "ACTIVE", type: { in: ["PREPARATION", "GARNISH", "COCKTAIL"] } },
      select: {
        id: true,
        type: true,
        name: true,
        parentComponents: { select: { componentProductId: true } },
        cocktailGarnishes: { select: { garnishId: true } },
      },
    });
    return products.flatMap((product) => {
      if (product.type === "INGREDIENT") return [];
      return [
        {
          id: product.id,
          type: product.type,
          name: product.name,
          componentIds: product.parentComponents.map((component) => component.componentProductId),
          garnishIds: product.cocktailGarnishes.map((garnish) => garnish.garnishId),
        },
      ];
    });
  }

  replace(
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
      categoryCode: string;
      output?: { amount: number; unitId: string };
      components: Array<{
        productId: string;
        productVenueId: string | null;
        unitId: string;
        amount: number;
        position: number;
      }>;
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
        outputAmount: input.output?.amount ?? null,
        outputUnitId: input.output?.unitId ?? null,
        updatedByUserId: input.userId,
        preparation: { update: { categoryCode: input.categoryCode } },
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
      },
      select: { id: true, type: true, name: true, venueId: true },
    });
  }
}
