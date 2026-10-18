import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, type PrismaClient } from "@bartech/database";
import {
  componentSummary,
  readComponentProducts,
  requireComponentProduct,
} from "../read-component-products.js";
import type {
  PreparationCard,
  PreparationListItem,
  PreparationListSort,
} from "./preparation-read.dto.js";

@Injectable()
export class PreparationReadRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: PrismaClient) {}

  async list(
    venueId: string,
    matchingIds?: string[],
    categoryCode?: string,
    sort: PreparationListSort = "name",
  ): Promise<PreparationListItem[]> {
    const preparations = await this.database.product.findMany({
      where: {
        venueId,
        type: "PREPARATION",
        status: "ACTIVE",
        ...(matchingIds ? { id: { in: matchingIds } } : {}),
        ...(categoryCode ? { preparation: { categoryCode } } : {}),
      },
      orderBy: sort === "updated" ? [{ updatedAt: "desc" }, { name: "asc" }] : { name: "asc" },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        preparation: { select: { category: { select: { name: true } } } },
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
      preparations.flatMap((preparation) =>
        preparation.parentComponents.map((component) => component.componentProductId),
      ),
    );
    return preparations.flatMap((preparation) => {
      const categoryName = preparation.preparation?.category.name;
      if (!categoryName) return [];
      return [
        {
          id: preparation.id,
          name: preparation.name,
          categoryName,
          componentSummary: componentSummary(
            products,
            preparation.parentComponents.map((component) => component.componentProductId),
          ),
          updatedAt: preparation.updatedAt,
        },
      ];
    });
  }

  async getById(venueId: string, preparationId: string): Promise<PreparationCard | null> {
    const preparation = await this.database.product.findFirst({
      where: { id: preparationId, venueId, type: "PREPARATION", status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        technology: true,
        comment: true,
        outputAmount: true,
        outputUnit: { select: { id: true, label: true } },
        preparation: { select: { categoryCode: true, category: { select: { name: true } } } },
        parentComponents: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            componentProductId: true,
            amount: true,
            unit: { select: { id: true, label: true } },
          },
        },
      },
    });
    if (!preparation?.technology || !preparation.preparation?.category.name) return null;
    const products = await readComponentProducts(
      this.database,
      venueId,
      preparation.parentComponents.map((component) => component.componentProductId),
    );

    return {
      id: preparation.id,
      name: preparation.name,
      type: "PREPARATION",
      status: "ACTIVE",
      categoryCode: preparation.preparation.categoryCode,
      categoryName: preparation.preparation.category.name,
      components: preparation.parentComponents.map((component) => {
        const product = requireComponentProduct(products, component.componentProductId);
        return {
          id: component.id,
          productId: product.id,
          productType: product.type,
          name: product.name,
          amount: Number(component.amount),
          unitId: component.unit.id,
          unit: component.unit.label,
        };
      }),
      technology: preparation.technology,
      output:
        preparation.outputAmount && preparation.outputUnit
          ? {
              amount: Number(preparation.outputAmount),
              unitId: preparation.outputUnit.id,
              unit: preparation.outputUnit.label,
            }
          : null,
      comment: preparation.comment,
    };
  }
}
