import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  DATABASE_CLIENT,
  type Prisma,
  type PrismaClient,
  type ProductType,
} from "@bartech/database";
import type { ArchiveCard } from "./archive.dto.js";

export type ArchiveDatabase = PrismaClient | Prisma.TransactionClient;

const archiveProductInclude = {
  parentComponents: { orderBy: { position: "asc" }, include: { unit: true } },
  cocktailGarnishes: { orderBy: { position: "asc" }, include: { garnish: true } },
  cocktailQuickGarnishes: {
    orderBy: { position: "asc" },
    include: { referenceValue: true },
  },
  outputUnit: true,
  ingredient: { include: { category: true } },
  preparation: { include: { category: true } },
  cocktail: { include: { glass: true, ice: true, preparationMethod: true } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ArchiveReadRepository {
  constructor(@Inject(DATABASE_CLIENT) readonly database: PrismaClient) {}

  list(venueId: string, query?: string, type?: ProductType) {
    return this.database.product.findMany({
      where: {
        venueId,
        status: "ARCHIVED",
        ...(type ? { type } : {}),
        ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
      },
      orderBy: [{ nameNormalized: "asc" }, { id: "asc" }],
      select: { id: true, type: true, name: true, updatedAt: true },
    });
  }

  ingredientOptions(venueId: string, query?: string) {
    return this.database.product.findMany({
      where: {
        venueId,
        type: "INGREDIENT",
        status: "ACTIVE",
        ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
      },
      orderBy: [{ nameNormalized: "asc" }, { id: "asc" }],
      take: 30,
      select: { id: true, type: true, name: true },
    });
  }

  async graph(database: ArchiveDatabase, venueId: string) {
    const local = await database.product.findMany({
      where: { venueId },
      orderBy: { id: "asc" },
      include: archiveProductInclude,
    });
    const globalIds = [
      ...new Set(
        local.flatMap((product) =>
          product.parentComponents
            .filter((row) => row.componentVenueId === null)
            .map((row) => row.componentProductId),
        ),
      ),
    ];
    const globals = await database.product.findMany({
      where: { id: { in: globalIds }, venueId: null, type: "INGREDIENT", status: "ACTIVE" },
      select: { id: true, name: true, type: true, status: true, venueId: true },
      orderBy: { id: "asc" },
    });
    return { local, globals };
  }

  async card(venueId: string, productId: string): Promise<ArchiveCard | null> {
    const product = await this.database.product.findFirst({
      where: { id: productId, venueId, status: "ARCHIVED" },
      include: archiveProductInclude,
    });
    if (!product) return null;
    const linkedProducts = await this.database.product.findMany({
      where: {
        id: {
          in: [
            ...product.parentComponents.map((row) => row.componentProductId),
            ...product.cocktailGarnishes.map((row) => row.garnishId),
          ],
        },
        OR: [{ venueId }, { venueId: null, type: "INGREDIENT", status: "ACTIVE" }],
      },
      select: { id: true, name: true, type: true, status: true },
    });
    const products = new Map(linkedProducts.map((item) => [item.id, item]));
    const scopedUnit = (unit: { venueId: string | null } | null) =>
      unit && (unit.venueId === null || unit.venueId === venueId);
    if (
      (product.outputUnit && !scopedUnit(product.outputUnit)) ||
      product.parentComponents.some((row) => !scopedUnit(row.unit))
    )
      throw new NotFoundException("Связанные данные недоступны");
    for (const reference of [
      product.cocktail?.glass,
      product.cocktail?.ice,
      product.cocktail?.preparationMethod,
    ]) {
      if (reference && reference.venueId !== null && reference.venueId !== venueId)
        throw new NotFoundException("Связанные данные недоступны");
    }
    return {
      id: product.id,
      type: product.type,
      name: product.name,
      status: "ARCHIVED",
      updatedAt: product.updatedAt,
      technology: product.technology,
      comment: product.comment,
      category: product.ingredient?.category.name ?? product.preparation?.category.name ?? null,
      brand: product.ingredient?.brand ?? null,
      strength:
        product.ingredient?.strength === null || product.ingredient?.strength === undefined
          ? null
          : Number(product.ingredient.strength),
      country: product.ingredient?.country ?? null,
      externalIdentifier: product.ingredient?.externalIdentifier ?? null,
      components: product.parentComponents.map((row) => {
        const component = products.get(row.componentProductId);
        if (!component) throw new NotFoundException("Компонент состава недоступен");
        return {
          id: row.id,
          productId: component.id,
          productType: component.type,
          name: component.name,
          status: component.status,
          amount: Number(row.amount),
          unitId: row.unitId,
          unit: row.unit.label,
        };
      }),
      garnishes: [
        ...product.cocktailGarnishes.map((row) => {
          const garnish = products.get(row.garnishId);
          if (!garnish || garnish.type !== "GARNISH")
            throw new NotFoundException("Гарнир недоступен");
          return {
            id: garnish.id,
            type: garnish.type,
            name: garnish.name,
            status: garnish.status,
            kind: "PRODUCT" as const,
            position: row.position,
          };
        }),
        ...product.cocktailQuickGarnishes.map((row) => ({
          id: row.referenceValue.id,
          type: "QUICK" as const,
          name: row.referenceValue.label,
          status: null,
          kind: "QUICK" as const,
          position: row.position,
        })),
      ]
        .sort((a, b) => a.position - b.position)
        .map((garnish) =>
          garnish.kind === "QUICK"
            ? {
                id: garnish.id,
                type: "QUICK" as const,
                name: garnish.name,
                status: null,
                kind: "QUICK" as const,
              }
            : {
                id: garnish.id,
                type: garnish.type,
                name: garnish.name,
                status: garnish.status,
                kind: "PRODUCT" as const,
              },
        ),
      output:
        product.outputAmount && product.outputUnit
          ? {
              amount: Number(product.outputAmount),
              unitId: product.outputUnit.id,
              unit: product.outputUnit.label,
            }
          : null,
      glass: product.cocktail?.glass?.label ?? null,
      ice: product.cocktail?.ice?.label ?? null,
      preparationMethod: product.cocktail?.preparationMethod?.label ?? null,
    };
  }
}

export type ArchiveGraph = Awaited<ReturnType<ArchiveReadRepository["graph"]>>;
export type ArchiveGraphProduct = ArchiveGraph["local"][number];
