type Component = {
  productId: string;
  unitId: string;
  amount: { toString(): string } | string | number;
};

export function componentAuditDiff(
  before: Component[],
  after: Component[],
  productNames: Map<string, string>,
  unitLabels: Map<string, string>,
): string[] {
  const changes: string[] = [];
  const productIds = new Set([...before, ...after].map(({ productId }) => productId));
  for (const productId of productIds) {
    const name = productNames.get(productId) ?? "Компонент";
    const oldItems = before.filter((component) => component.productId === productId);
    const newItems = after.filter((component) => component.productId === productId);
    for (let oldIndex = oldItems.length - 1; oldIndex >= 0; oldIndex--) {
      const oldComponent = oldItems[oldIndex]!;
      const matchIndex = newItems.findIndex(
        (component) =>
          component.unitId === oldComponent.unitId &&
          component.amount.toString() === oldComponent.amount.toString(),
      );
      if (matchIndex >= 0) {
        oldItems.splice(oldIndex, 1);
        newItems.splice(matchIndex, 1);
      }
    }
    while (oldItems.length && newItems.length) {
      const oldComponent = oldItems.shift()!;
      const next = newItems.shift()!;
      changes.push(
        `Компонент: ${name}, ${amountLabel(oldComponent, unitLabels)} → ${amountLabel(next, unitLabels)}`,
      );
    }
    for (const oldComponent of oldItems)
      changes.push(`Удалён компонент: ${name} (${amountLabel(oldComponent, unitLabels)})`);
    for (const component of newItems)
      changes.push(`Добавлен компонент: ${name} (${amountLabel(component, unitLabels)})`);
  }
  return changes;
}

export function valueAuditDiff(label: string, before: unknown, after: unknown): string | null {
  if (before === after || (before == null && after == null)) return null;
  if (
    [before, after].every(
      (value) => typeof value === "string" || typeof value === "number" || value == null,
    )
  ) {
    return `${label}: ${before ?? "не задано"} → ${after ?? "не задано"}`;
  }
  return `${label}: изменено`;
}

function amountLabel(component: Component, unitLabels: Map<string, string>): string {
  return `${component.amount.toString()} ${unitLabels.get(component.unitId) ?? "ед."}`;
}
