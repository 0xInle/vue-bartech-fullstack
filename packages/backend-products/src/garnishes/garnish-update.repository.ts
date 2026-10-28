import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, Prisma, type PrismaClient } from "@bartech/database";
import type { GarnishImpactItem } from "./garnish-impact.js";

@Injectable()
export class GarnishUpdateRepository {
  constructor(@Inject(DATABASE_CLIENT) readonly database: PrismaClient) {}

  lockVenue(transaction: Prisma.TransactionClient, venueId: string) {
    return transaction.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_advisory_xact_lock(hashtextextended(${venueId}, 0)) IS NULL AS locked
    `;
  }

  findActive(transaction: Prisma.TransactionClient, venueId: string, garnishId: string) {
    return transaction.product.findFirst({
      where: { id: garnishId, venueId, type: "GARNISH", status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        technology: true,
        comment: true,
        outputAmount: true,
        outputUnitId: true,
        parentComponents: {
          orderBy: { position: "asc" },
          select: { componentProductId: true, unitId: true, amount: true },
        },
      },
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

  async findActiveDependents(
    transaction: Prisma.TransactionClient,
    venueId: string,
    garnishId: string,
  ): Promise<GarnishImpactItem[]> {
    const cocktails = await transaction.product.findMany({
      where: {
        venueId,
        type: "COCKTAIL",
        status: "ACTIVE",
        cocktailGarnishes: { some: { garnishId } },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    });
    return cocktails.map((cocktail) => ({ ...cocktail, type: "COCKTAIL" }));
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
        parentComponents: {
          deleteMany: { parentProductId: input.id, parentVenueId: input.venueId },
          create: input.components.map((component) => ({
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
