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
  if (
    response.code === "PRODUCT_PERMANENT_DELETE_DEPENDENCIES" ||
    response.code === "PRODUCT_PERMANENT_DELETE_PLAN_CHANGED"
  ) {
    const plan = readPermanentDeletePlan(response.plan);
    return {
      code: response.code,
      ...(typeof response.message === "string" ? { message: response.message } : {}),
      ...(plan ? { plan } : {}),
    };
  }
  if (response.code === "PRODUCT_ARCHIVE_ACTIVE_DEPENDENCIES") {
    const affectedProducts = summaries(response.affectedProducts);
    return affectedProducts ? { code: response.code, affectedProducts } : null;
  }
  if (response.code === "PRODUCT_ARCHIVE_PLAN_CHANGED") {
    const rawPlan = record(response.plan);
    const archiveChain = rawPlan?.archiveChain;
    const permanentPlan = Array.isArray(archiveChain)
      ? readPermanentDeletePlan({ ...rawPlan, deleteChain: archiveChain })
      : null;
    const canReplace = rawPlan?.canReplace;
    const plan =
      permanentPlan && typeof canReplace === "boolean"
        ? {
            root: permanentPlan.root,
            activeUsages: permanentPlan.activeUsages,
            archivedUsages: permanentPlan.archivedUsages,
            archiveChain: permanentPlan.deleteChain,
            canReplace,
            confirmationFingerprint: permanentPlan.confirmationFingerprint,
          }
        : null;
    return {
      code: response.code,
      ...(typeof response.message === "string" ? { message: response.message } : {}),
      ...(plan ? { plan } : {}),
    };
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
    if (!node || !base || typeof node.nameConflict !== "boolean") return null;
    dependencies.push({ ...base, nameConflict: node.nameConflict });
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

function readPermanentDeletePlan(value: unknown): Record<string, unknown> | null {
  const plan = record(value);
  const rootValue = record(plan?.root);
  const root = summary(rootValue);
  const fingerprint = plan?.confirmationFingerprint;
  if (
    !plan ||
    !rootValue ||
    !root ||
    !["ACTIVE", "ARCHIVED"].includes(String(rootValue.status)) ||
    typeof fingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(fingerprint) ||
    !Array.isArray(plan.activeUsages) ||
    !Array.isArray(plan.archivedUsages) ||
    !Array.isArray(plan.deleteChain)
  )
    return null;
  const readUsage = (value: unknown) => {
    const usage = record(value);
    const replacements = summaries(usage?.replacements);
    if (
      !usage ||
      typeof usage.id !== "string" ||
      typeof usage.parentId !== "string" ||
      typeof usage.parentName !== "string" ||
      !["INGREDIENT", "PREPARATION", "GARNISH", "COCKTAIL"].includes(String(usage.parentType)) ||
      !["ACTIVE", "ARCHIVED"].includes(String(usage.parentStatus)) ||
      !["COMPONENT", "GARNISH"].includes(String(usage.relation)) ||
      !replacements
    )
      return null;
    return { ...usage, replacements };
  };
  const activeUsages = plan.activeUsages.map(readUsage);
  const archivedUsages = plan.archivedUsages.map(readUsage);
  const deleteChain = plan.deleteChain.map((item) => {
    const product = record(item);
    const base = summary(item);
    return base && ["ACTIVE", "ARCHIVED"].includes(String(product?.status))
      ? { ...base, status: product!.status }
      : null;
  });
  if (
    activeUsages.some((item) => item === null) ||
    archivedUsages.some((item) => item === null) ||
    deleteChain.some((item) => item === null)
  )
    return null;
  return {
    root: { ...root, status: rootValue.status },
    activeUsages,
    archivedUsages,
    deleteChain,
    confirmationFingerprint: fingerprint,
  };
}
