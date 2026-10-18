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

  async list(venueId: string, matchingIds?: string[]): Promise<CocktailListItem[]> {
    const cocktails = await this.database.product.findMany({
      where: {
        venueId,
        type: "COCKTAIL",
        status: "ACTIVE",
        ...(matchingIds ? { id: { in: matchingIds } } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        updatedAt: true,
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
          select: { garnish: { select: { id: true, name: true } } },
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
      garnishes: cocktail.cocktailGarnishes.flatMap((item) =>
        item.garnish ? [{ id: item.garnish.id, name: item.garnish.name }] : [],
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

  async listGarnishes(venueId: string, matchingIds?: string[]): Promise<CocktailGarnishOption[]> {
    return this.database.product.findMany({
      where: {
        venueId,
        type: "GARNISH",
        status: "ACTIVE",
        ...(matchingIds ? { id: { in: matchingIds } } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  }
}
