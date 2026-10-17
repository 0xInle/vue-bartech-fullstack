import { BadRequestException, ConflictException } from "@nestjs/common";
import type { ProductType } from "@bartech/database";

export function normalizeProductName(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

export function normalizeReferenceCode(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

export function assertPositiveAmount(amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BadRequestException("Количество должно быть больше нуля");
  }
}

export function assertNonEmptyRecipe(technology: string, components: unknown[]): void {
  if (!technology.trim()) throw new BadRequestException("Укажите технологию приготовления");
  if (!components.length) throw new BadRequestException("Добавьте хотя бы один компонент состава");
}

export function assertAllowedComponent(parentType: ProductType, componentType: ProductType): void {
  const allowed: Record<ProductType, ProductType[]> = {
    INGREDIENT: [],
    PREPARATION: ["INGREDIENT", "PREPARATION"],
    GARNISH: ["INGREDIENT", "PREPARATION"],
    COCKTAIL: ["INGREDIENT", "PREPARATION"],
  };

  if (!allowed[parentType].includes(componentType)) {
    throw new BadRequestException("Этот тип продукции нельзя добавить в состав");
  }
}

export function assertPreparationGraphAcyclic(
  parentId: string,
  componentIds: string[],
  edges: Array<{ parentProductId: string; componentProductId: string }>,
): void {
  const childrenByParent = new Map<string, string[]>();
  for (const edge of edges) {
    const children = childrenByParent.get(edge.parentProductId) ?? [];
    children.push(edge.componentProductId);
    childrenByParent.set(edge.parentProductId, children);
  }

  const reachesParent = (productId: string, visited: Set<string>): boolean => {
    if (productId === parentId) return true;
    if (visited.has(productId)) return false;
    visited.add(productId);
    return (childrenByParent.get(productId) ?? []).some((childId) =>
      reachesParent(childId, visited),
    );
  };

  if (componentIds.some((componentId) => reachesParent(componentId, new Set()))) {
    throw new ConflictException({
      code: "PRODUCT_PREPARATION_CYCLE",
      message: "Состав создаёт циклическую зависимость заготовок",
    });
  }
}
