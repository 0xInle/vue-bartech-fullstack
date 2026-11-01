import { createHash } from "node:crypto";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { ProductType } from "@bartech/database";
import { assertAllowedComponent } from "../product-rules.js";
import type { ArchiveGraph } from "./archive-read.repository.js";
import type {
  PermanentDeletePlan,
  PermanentDeleteProduct,
  PermanentDeleteUsage,
} from "./archive.dto.js";
import { productLinks } from "./archive-restore-plan.js";

const deletableTypes: ProductType[] = ["COCKTAIL", "PREPARATION", "INGREDIENT", "GARNISH"];

export function buildPermanentDeletePlan(
  graph: ArchiveGraph,
  productId: string,
  globalReplacements: Array<{ id: string; type: ProductType; name: string }> = [],
): PermanentDeletePlan {
  const products = new Map(graph.local.map((product) => [product.id, product]));
  const root = products.get(productId);
  if (!root || !deletableTypes.includes(root.type))
    throw new NotFoundException("Продукт не найден или недоступен");

  const activeUsages: PermanentDeleteUsage[] = [];
  const archivedUsages: PermanentDeleteUsage[] = [];
  const parentsByChild = new Map<string, Set<string>>();
  for (const parent of graph.local) {
    for (const link of productLinks(parent)) {
      const child = products.get(link.productId);
      if (!child) continue;
      const parents = parentsByChild.get(child.id) ?? new Set<string>();
      parents.add(parent.id);
      parentsByChild.set(child.id, parents);
      if (child.id === productId) {
        const replacements =
          parent.status === "ACTIVE"
            ? [
                ...graph.local
                  .filter((candidate) => candidate.id !== child.id && candidate.status === "ACTIVE")
                  .filter((candidate) => {
                    if (link.garnish)
                      return (
                        parent.type === "COCKTAIL" &&
                        candidate.type === "GARNISH" &&
                        !parent.cocktailGarnishes.some((row) => row.garnishId === candidate.id)
                      );
                    try {
                      assertAllowedComponent(parent.type, candidate.type);
                      return true;
                    } catch {
                      return false;
                    }
                  })
                  .map(({ id, type, name }) => ({ id, type, name })),
                ...(!link.garnish && ["COCKTAIL", "PREPARATION", "GARNISH"].includes(parent.type)
                  ? globalReplacements
                  : []),
              ]
            : [];
        const usage: PermanentDeleteUsage = {
          id: link.rowId,
          parentId: parent.id,
          parentType: parent.type,
          parentName: parent.name,
          parentStatus: parent.status,
          relation: link.garnish ? "GARNISH" : "COMPONENT",
          replacements,
        };
        (parent.status === "ACTIVE" ? activeUsages : archivedUsages).push(usage);
      }
    }
  }

  const deleteIds = new Set([productId]);
  const queue = [productId];
  while (queue.length) {
    const childId = queue.shift()!;
    for (const parentId of parentsByChild.get(childId) ?? []) {
      if (deleteIds.has(parentId)) continue;
      deleteIds.add(parentId);
      queue.push(parentId);
    }
  }
  const deleteChain = [...deleteIds]
    .map((id) => products.get(id)!)
    .map(({ id, type, name, status }) => ({ id, type, name, status }));
  const confirmationFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        products: graph.local.map((product) => ({
          id: product.id,
          type: product.type,
          status: product.status,
          name: product.nameNormalized,
          updatedAt: product.updatedAt.toISOString(),
          links: productLinks(product),
        })),
        globalReplacements: globalReplacements
          .map(({ id, name }) => ({ id, name }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      }),
    )
    .digest("hex");
  if (activeUsages.length + archivedUsages.length && deleteChain.length === 1)
    throw new ConflictException("Граф зависимостей изменился. Обновите план удаления");
  const summary = ({
    id,
    type,
    name,
    status,
  }: (typeof graph.local)[number]): PermanentDeleteProduct => ({ id, type, name, status });
  const sortUsages = (usages: PermanentDeleteUsage[]) =>
    usages.sort((a, b) => a.parentName.localeCompare(b.parentName) || a.id.localeCompare(b.id));
  return {
    root: summary(root),
    activeUsages: sortUsages(activeUsages),
    archivedUsages: sortUsages(archivedUsages),
    deleteChain: deleteChain.sort((a, b) => a.id.localeCompare(b.id)),
    confirmationFingerprint,
  };
}
