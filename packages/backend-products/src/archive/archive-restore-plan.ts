import { createHash } from "node:crypto";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { assertAllowedComponent, normalizeProductName } from "../product-rules.js";
import type { ArchiveRestoreInput, ArchiveRestorePlan } from "./archive.dto.js";
import type { ArchiveGraph, ArchiveGraphProduct } from "./archive-read.repository.js";

export function productLinks(product: ArchiveGraphProduct) {
  return [
    ...product.parentComponents.map((row) => ({
      rowId: row.id,
      productId: row.componentProductId,
      garnish: false,
    })),
    ...product.cocktailGarnishes.map((row) => ({
      rowId: row.id,
      productId: row.garnishId,
      garnish: true,
    })),
  ];
}

export function buildRestorePlan(graph: ArchiveGraph, productId: string): ArchiveRestorePlan {
  const products = new Map(graph.local.map((product) => [product.id, product]));
  const root = products.get(productId);
  if (!root || root.status !== "ARCHIVED")
    throw new NotFoundException("Продукт не найден или недоступен");
  const globals = new Set(graph.globals.map((product) => product.id));
  const dependencies = new Map<string, ArchiveGraphProduct>();
  const complete = new Set<string>();
  const visit = (product: ArchiveGraphProduct, path: Set<string>) => {
    if (path.has(product.id))
      throw new ConflictException("Обнаружен цикл зависимостей. Обратитесь в поддержку");
    if (complete.has(product.id)) return;
    path.add(product.id);
    for (const link of productLinks(product)) {
      const child = products.get(link.productId);
      if (!child) {
        if (!link.garnish && globals.has(link.productId)) continue;
        throw new NotFoundException("Компонент состава недоступен");
      }
      if (
        link.garnish
          ? child.type !== "GARNISH"
          : !["INGREDIENT", "PREPARATION"].includes(child.type)
      )
        throw new ConflictException("Состав содержит недопустимый тип продукции");
      if (child.status === "ARCHIVED") dependencies.set(child.id, child);
      visit(child, path);
    }
    path.delete(product.id);
    complete.add(product.id);
  };
  visit(root, new Set());

  const chain = [
    root,
    ...[...dependencies.values()].sort((left, right) => left.id.localeCompare(right.id)),
  ];
  const conflictingIds = new Set<string>();
  for (const product of chain) {
    if (
      graph.local.some(
        (candidate) =>
          candidate.status === "ACTIVE" &&
          candidate.type === product.type &&
          candidate.nameNormalized === product.nameNormalized,
      )
    )
      conflictingIds.add(product.id);
  }
  const chainNames = new Map<string, string[]>();
  for (const product of chain) {
    const key = `${product.type}:${product.nameNormalized}`;
    const ids = chainNames.get(key) ?? [];
    ids.push(product.id);
    chainNames.set(key, ids);
  }
  for (const ids of chainNames.values())
    if (ids.length > 1 && ids.some((id) => conflictingIds.has(id)))
      ids.forEach((id) => conflictingIds.add(id));
    else if (ids.length > 1) ids.slice(1).forEach((id) => conflictingIds.add(id));

  const confirmationFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        root: productId,
        products: graph.local.map((product) => ({
          id: product.id,
          type: product.type,
          status: product.status,
          name: product.nameNormalized,
          updatedAt: product.updatedAt.toISOString(),
          links: productLinks(product),
        })),
        globals: graph.globals,
      }),
    )
    .digest("hex");
  return {
    root: {
      id: root.id,
      type: root.type,
      name: root.name,
      nameConflict: conflictingIds.has(root.id),
    },
    dependencies: [...dependencies.values()]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(({ id, type, name }) => ({ id, type, name, nameConflict: conflictingIds.has(id) })),
    confirmationFingerprint,
  };
}

export function resolveRestore(
  graph: ArchiveGraph,
  plan: ArchiveRestorePlan,
  input: ArchiveRestoreInput,
) {
  const products = new Map(graph.local.map((product) => [product.id, product]));
  const nodes = new Map([
    [plan.root.id, plan.root],
    ...plan.dependencies.map((node) => [node.id, node] as const),
  ]);
  const requestedNames = new Map(input.names.map(({ productId, name }) => [productId, name]));
  if (
    requestedNames.size !== input.names.length ||
    input.names.some((entry) => !nodes.get(entry.productId)?.nameConflict)
  )
    throw new BadRequestException("План содержит повторяющиеся или недопустимые названия");

  const restored = new Map<string, string>();
  const complete = new Set<string>();
  const walk = (id: string, path: Set<string>) => {
    if (path.has(id))
      throw new ConflictException("Обнаружен цикл зависимостей. Обратитесь в поддержку");
    if (complete.has(id)) return;
    const product = products.get(id);
    if (!product)
      throw new ConflictException("Состав цепочки изменился. Обновите план восстановления");
    path.add(id);
    if (product.status === "ARCHIVED") {
      const name = (requestedNames.get(id) ?? product.name).trim().replace(/\s+/gu, " ");
      if (!name || name.length > 160)
        throw new BadRequestException("Введите название длиной от 1 до 160 символов");
      const normalized = normalizeProductName(name);
      if (
        graph.local.some(
          (candidate) =>
            candidate.status === "ACTIVE" &&
            candidate.type === product.type &&
            candidate.nameNormalized === normalized,
        ) ||
        [...restored].some(
          ([restoredId, restoredName]) =>
            products.get(restoredId)!.type === product.type &&
            normalizeProductName(restoredName) === normalized,
        )
      )
        throw new ConflictException({
          code: "PRODUCT_ARCHIVE_NAME_CONFLICT",
          message: "Название уже занято. Укажите другое название продукта",
          productId: id,
        });
      restored.set(id, name);
    }
    for (const link of productLinks(product))
      if (products.has(link.productId)) walk(link.productId, path);
    path.delete(id);
    complete.add(id);
  };
  walk(plan.root.id, new Set());
  if ([...restored.keys()].some((id) => !nodes.has(id)))
    throw new ConflictException("Состав цепочки изменился. Обновите план восстановления");
  if ([...requestedNames.keys()].some((id) => !restored.has(id)))
    throw new BadRequestException("Название указано для продукта вне восстанавливаемой цепочки");

  for (const id of restored.keys()) {
    const product = products.get(id)!;
    const unitAllowed = (unit: { venueId: string | null } | null) =>
      unit !== null && (unit.venueId === null || unit.venueId === product.venueId);
    if (
      product.parentComponents.some((row) => !unitAllowed(row.unit)) ||
      (product.outputUnitId && !unitAllowed(product.outputUnit))
    )
      throw new ConflictException("Единица измерения недоступна");
    for (const reference of [
      product.cocktail?.glass,
      product.cocktail?.ice,
      product.cocktail?.preparationMethod,
    ])
      if (reference && reference.venueId !== null && reference.venueId !== product.venueId)
        throw new ConflictException("Справочное значение недоступно");
    for (const link of productLinks(product)) {
      const child = products.get(link.productId);
      if (child && child.status === "ARCHIVED" && !restored.has(child.id))
        throw new ConflictException("В составе остаётся архивная зависимость");
      if (child && !link.garnish) assertAllowedComponent(product.type, child.type);
      if (link.garnish && (child?.type !== "GARNISH" || product.type !== "COCKTAIL"))
        throw new ConflictException("Недопустимый гарнир");
    }
  }
  return { restored };
}
