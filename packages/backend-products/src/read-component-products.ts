import { NotFoundException } from "@nestjs/common";
import type { PrismaClient } from "@bartech/database";

type ComponentProduct = {
  id: string;
  name: string;
  type: "INGREDIENT" | "PREPARATION";
  venueId: string | null;
};

export async function readComponentProducts(
  database: PrismaClient,
  venueId: string,
  componentIds: string[],
): Promise<Map<string, ComponentProduct>> {
  const ids = [...new Set(componentIds)];
  if (!ids.length) return new Map();
  const products = await database.product.findMany({
    where: {
      id: { in: ids },
      status: "ACTIVE",
      OR: [
        { venueId: null, type: "INGREDIENT" },
        { venueId, type: { in: ["INGREDIENT", "PREPARATION"] } },
      ],
    },
    select: { id: true, name: true, type: true, venueId: true },
  });
  const components = new Map<string, ComponentProduct>();
  for (const product of products) {
    if (product.type === "INGREDIENT" || product.type === "PREPARATION") {
      components.set(product.id, {
        id: product.id,
        name: product.name,
        type: product.type,
        venueId: product.venueId,
      });
    }
  }
  return components;
}

export function requireComponentProduct(
  products: Map<string, ComponentProduct>,
  productId: string,
): ComponentProduct {
  const product = products.get(productId);
  if (!product) throw new NotFoundException("Компонент состава недоступен");
  return product;
}

export function componentSummary(
  products: Map<string, ComponentProduct>,
  componentIds: string[],
): string {
  return componentIds.map((id) => products.get(id)?.name ?? "Компонент недоступен").join(", ");
}
