import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, type PrismaClient } from "@bartech/database";
import {
  componentSummary,
  readComponentProducts,
  requireComponentProduct,
} from "../read-component-products.js";
import type { CocktailCard, CocktailGarnishOption, CocktailListItem } from "./cocktail-read.dto.js";

@Injectable()
export class CocktailReadRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: PrismaClient) {}

  async list(
    venueId: string,
    matchingIds?: string[],
    categoryId?: string,
  ): Promise<CocktailListItem[]> {
    const cocktails = await this.database.product.findMany({
      where: {
        venueId,
        type: "COCKTAIL",
        status: "ACTIVE",
        ...(matchingIds ? { id: { in: matchingIds } } : {}),
        ...(categoryId ? { cocktailCategories: { some: { referenceValueId: categoryId } } } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        updatedAt: true,
        cocktailCategories: {
          orderBy: { referenceValue: { label: "asc" } },
          select: { referenceValue: { select: { label: true } } },
        },
        parentComponents: {
          orderBy: { position: "asc" },
          take: 3,
          select: { componentProductId: true },
        },
      },
    });

    const products = await readComponentProducts(
      this.database,
      venueId,
      cocktails.flatMap((cocktail) =>
        cocktail.parentComponents.map((component) => component.componentProductId),
      ),
    );
    return cocktails.map((cocktail) => ({
      id: cocktail.id,
      name: cocktail.name,
      categories: cocktail.cocktailCategories.flatMap(({ referenceValue }) =>
        referenceValue ? [referenceValue.label] : [],
      ),
      componentSummary: componentSummary(
        products,
        cocktail.parentComponents.map((component) => component.componentProductId),
      ),
      updatedAt: cocktail.updatedAt,
    }));
  }

  async getById(venueId: string, cocktailId: string): Promise<CocktailCard | null> {
    const cocktail = await this.database.product.findFirst({
      where: { id: cocktailId, venueId, type: "COCKTAIL", status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        technology: true,
        comment: true,
        outputAmount: true,
        outputUnit: { select: { id: true, label: true } },
        cocktail: {
          select: {
            glassId: true,
            iceId: true,
            preparationMethodId: true,
            glass: { select: { label: true } },
            ice: { select: { label: true } },
            preparationMethod: { select: { label: true } },
          },
        },
        cocktailCategories: {
          orderBy: { referenceValue: { label: "asc" } },
          select: { referenceValue: { select: { id: true, label: true } } },
        },
        parentComponents: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            componentProductId: true,
            unitId: true,
            amount: true,
            unit: { select: { label: true } },
          },
        },
        cocktailGarnishes: {
          orderBy: { position: "asc" },
          select: { position: true, garnish: { select: { id: true, name: true } } },
        },
        cocktailQuickGarnishes: {
          orderBy: { position: "asc" },
          select: { position: true, referenceValue: { select: { id: true, label: true } } },
        },
      },
    });
    if (!cocktail || !cocktail.technology) return null;
    const products = await readComponentProducts(
      this.database,
      venueId,
      cocktail.parentComponents.map((component) => component.componentProductId),
    );

    return {
      id: cocktail.id,
      name: cocktail.name,
      type: "COCKTAIL",
      status: "ACTIVE",
      components: cocktail.parentComponents.map((component) => {
        const product = requireComponentProduct(products, component.componentProductId);
        return {
          id: component.id,
          productId: product.id,
          productType: product.type,
          unitId: component.unitId,
          name: product.name,
          amount: Number(component.amount),
          unit: component.unit.label,
        };
      }),
      garnishes: [
        ...cocktail.cocktailGarnishes.flatMap((item) =>
          item.garnish
            ? [
                {
                  id: item.garnish.id,
                  name: item.garnish.name,
                  kind: "PRODUCT" as const,
                  position: item.position,
                },
              ]
            : [],
        ),
        ...cocktail.cocktailQuickGarnishes.map((item) => ({
          id: item.referenceValue.id,
          name: item.referenceValue.label,
          kind: "QUICK" as const,
          position: item.position,
        })),
      ]
        .sort((a, b) => a.position - b.position)
        .map(({ id, name, kind }) => ({ id, name, kind })),
      categories: cocktail.cocktailCategories.flatMap(({ referenceValue }) =>
        referenceValue ? [referenceValue] : [],
      ),
      technology: cocktail.technology,
      output:
        cocktail.outputAmount && cocktail.outputUnit
          ? {
              amount: Number(cocktail.outputAmount),
              unitId: cocktail.outputUnit.id,
              unit: cocktail.outputUnit.label,
            }
          : null,
      comment: cocktail.comment,
      glass: cocktail.cocktail?.glass?.label ?? null,
      glassId: cocktail.cocktail?.glassId ?? null,
      ice: cocktail.cocktail?.ice?.label ?? null,
      iceId: cocktail.cocktail?.iceId ?? null,
      preparationMethod: cocktail.cocktail?.preparationMethod?.label ?? null,
      preparationMethodId: cocktail.cocktail?.preparationMethodId ?? null,
    };
  }

  async listGarnishes(
    venueId: string,
    query?: string,
    matchingIds?: string[],
  ): Promise<CocktailGarnishOption[]> {
    const [products, quickGarnishes] = await Promise.all([
      this.database.product.findMany({
        where: {
          venueId,
          type: "GARNISH",
          status: "ACTIVE",
          ...(matchingIds ? { id: { in: matchingIds } } : {}),
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      this.database.referenceValue.findMany({
        where: {
          venueId,
          type: "GARNISH",
          isActive: true,
          ...(query ? { label: { contains: query, mode: "insensitive" } } : {}),
        },
        orderBy: { label: "asc" },
        select: { id: true, label: true },
      }),
    ]);
    return [
      ...products.map((item) => ({ ...item, kind: "PRODUCT" as const })),
      ...quickGarnishes.map((item) => ({ id: item.id, name: item.label, kind: "QUICK" as const })),
    ].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }
}
