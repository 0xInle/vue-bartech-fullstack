type Summary = { id: string; type: string; name: string };

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function summary(value: unknown): Summary | null {
  const item = record(value);
  if (
    !item ||
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    typeof item.type !== "string" ||
    !["INGREDIENT", "PREPARATION", "GARNISH", "COCKTAIL"].includes(item.type)
  )
    return null;
  return { id: item.id, type: item.type, name: item.name };
}

function summaries(value: unknown): Summary[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(summary);
  return items.every((item): item is Summary => item !== null) ? items : null;
}

export function readArchiveProblem(value: unknown): Record<string, unknown> | null {
  const response = record(value);
  if (!response) return null;
  if (response.code === "PRODUCT_ARCHIVE_ACTIVE_DEPENDENCIES") {
    const affectedProducts = summaries(response.affectedProducts);
    return affectedProducts ? { code: response.code, affectedProducts } : null;
  }
  if (response.code === "PRODUCT_ARCHIVE_NAME_CONFLICT" && typeof response.productId === "string")
    return { code: response.code, productId: response.productId };
  if (response.code !== "PRODUCT_ARCHIVE_RESTORE_PLAN_CHANGED") return null;
  const plan = record(response.restorePlan);
  const root = summary(plan?.root);
  const rootDetails = record(plan?.root);
  if (
    !plan ||
    !root ||
    typeof rootDetails?.nameConflict !== "boolean" ||
    typeof plan.confirmationFingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(plan.confirmationFingerprint) ||
    !Array.isArray(plan.dependencies)
  )
    return null;
  const dependencies = [];
  for (const value of plan.dependencies) {
    const node = record(value);
    const base = summary(value);
    const replacements = summaries(node?.replacements);
    if (
      !node ||
      !base ||
      !replacements ||
      typeof node.nameConflict !== "boolean" ||
      !Array.isArray(node.parentIds) ||
      !node.parentIds.every((id: unknown) => typeof id === "string")
    )
      return null;
    dependencies.push({
      ...base,
      nameConflict: node.nameConflict,
      parentIds: node.parentIds,
      replacements,
    });
  }
  return {
    code: response.code,
    restorePlan: {
      root: { ...root, nameConflict: rootDetails.nameConflict },
      dependencies,
      confirmationFingerprint: plan.confirmationFingerprint,
    },
  };
}
