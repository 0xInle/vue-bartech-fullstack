import { createHash } from "node:crypto";

export type PreparationImpactItem = {
  id: string;
  type: "PREPARATION" | "GARNISH" | "COCKTAIL";
  name: string;
};

type Dependent = PreparationImpactItem & { componentIds: string[]; garnishIds: string[] };

export function findPreparationImpact(
  preparationId: string,
  products: Dependent[],
): PreparationImpactItem[] {
  const parentsByChild = new Map<string, PreparationImpactItem[]>();
  for (const product of products) {
    for (const childId of [...product.componentIds, ...product.garnishIds]) {
      const parents = parentsByChild.get(childId) ?? [];
      parents.push({ id: product.id, type: product.type, name: product.name });
      parentsByChild.set(childId, parents);
    }
  }

  const visited = new Set([preparationId]);
  const pending = [preparationId];
  const affected: PreparationImpactItem[] = [];
  for (let index = 0; index < pending.length; index++) {
    for (const parent of parentsByChild.get(pending[index]!) ?? []) {
      if (visited.has(parent.id)) continue;
      visited.add(parent.id);
      affected.push(parent);
      pending.push(parent.id);
    }
  }
  return affected.sort(
    (left, right) =>
      left.type.localeCompare(right.type) ||
      left.name.localeCompare(right.name, "ru") ||
      left.id.localeCompare(right.id),
  );
}

export function preparationImpactFingerprint(
  venueId: string,
  preparationId: string,
  input: unknown,
  affectedProducts: PreparationImpactItem[],
): string {
  return createHash("sha256")
    .update(JSON.stringify({ venueId, preparationId, input, affectedProducts }))
    .digest("hex");
}
