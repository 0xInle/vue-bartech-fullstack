import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, type PrismaClient } from "@bartech/database";
import {
  componentSummary,
  readComponentProducts,
  requireComponentProduct,
} from "../read-component-products.js";
import type { GarnishCard, GarnishListItem, GarnishListSort } from "./garnish-read.dto.js";

@Injectable()
export class GarnishReadRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: PrismaClient) {}

  async list(
    venueId: string,
    matchingIds?: string[],
    sort: GarnishListSort = "name",
  ): Promise<GarnishListItem[]> {
    const garnishes = await this.database.product.findMany({
      where: {
        venueId,
        type: "GARNISH",
        status: "ACTIVE",
        ...(matchingIds ? { id: { in: matchingIds } } : {}),
      },
      orderBy: sort === "updated" ? [{ updatedAt: "desc" }, { name: "asc" }] : { name: "asc" },
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
      garnishes.flatMap((garnish) =>
        garnish.parentComponents.map((component) => component.componentProductId),
      ),
    );
    return garnishes.map((garnish) => ({
      id: garnish.id,
      name: garnish.name,
      componentSummary: componentSummary(
        products,
        garnish.parentComponents.map((component) => component.componentProductId),
      ),
      updatedAt: garnish.updatedAt,
    }));
  }

  async getById(venueId: string, garnishId: string): Promise<GarnishCard | null> {
    const garnish = await this.database.product.findFirst({
      where: { id: garnishId, venueId, type: "GARNISH", status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        technology: true,
        comment: true,
        outputAmount: true,
        outputUnit: { select: { id: true, label: true } },
        parentComponents: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            componentProductId: true,
            amount: true,
            unitId: true,
            unit: { select: { label: true } },
          },
        },
      },
    });
    if (!garnish?.technology) return null;
    const products = await readComponentProducts(
      this.database,
      venueId,
      garnish.parentComponents.map((component) => component.componentProductId),
    );

    return {
      id: garnish.id,
      name: garnish.name,
      type: "GARNISH",
      status: "ACTIVE",
      components: garnish.parentComponents.map((component) => {
        const product = requireComponentProduct(products, component.componentProductId);
        return {
          id: component.id,
          productId: product.id,
          productType: product.type,
          venueId: product.venueId,
          name: product.name,
          amount: Number(component.amount),
          unitId: component.unitId,
          unit: component.unit.label,
        };
      }),
      technology: garnish.technology,
      output:
        garnish.outputAmount && garnish.outputUnit
          ? {
              amount: Number(garnish.outputAmount),
              unitId: garnish.outputUnit.id,
              unit: garnish.outputUnit.label,
            }
          : null,
      comment: garnish.comment,
    };
  }
}
