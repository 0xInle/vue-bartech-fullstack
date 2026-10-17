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
  const parentIds = new Map<string, Set<string>>();
  const visited = new Set<string>();
  const visit = (product: ArchiveGraphProduct, path: Set<string>) => {
    if (path.has(product.id))
      throw new ConflictException("Обнаружен цикл зависимостей. Обратитесь в поддержку");
    if (visited.has(product.id)) return;
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
      if (child.status === "ARCHIVED") {
        const parents = parentIds.get(child.id) ?? new Set<string>();
        parents.add(product.id);
        parentIds.set(child.id, parents);
        visit(child, path);
      }
    }
    path.delete(product.id);
    visited.add(product.id);
  };
  visit(root, new Set());
  const nameConflict = (product: ArchiveGraphProduct) =>
    graph.local.some(
      (candidate) =>
        candidate.status === "ACTIVE" &&
        candidate.type === product.type &&
        candidate.nameNormalized === product.nameNormalized,
    );
  const dependencies = [...parentIds]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, parents]) => {
      const product = products.get(id)!;
      return {
        id,
        type: product.type,
        name: product.name,
        parentIds: [...parents].sort(),
        nameConflict: nameConflict(product),
        replacements: graph.local
          .filter(
            (candidate) =>
              candidate.status === "ACTIVE" &&
              (product.type === "GARNISH"
                ? candidate.type === "GARNISH" &&
                  [...parents].every((parentId) =>
                    products
                      .get(parentId)!
                      .cocktailGarnishes.every((row) => row.garnishId !== candidate.id),
                  )
                : ["INGREDIENT", "PREPARATION"].includes(candidate.type)),
          )
          .map(({ id, type, name }) => ({ id, type, name })),
      };
    });
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
    root: { id: root.id, type: root.type, name: root.name, nameConflict: nameConflict(root) },
    dependencies,
    confirmationFingerprint,
  };
}

export function resolveRestore(
  graph: ArchiveGraph,
  plan: ArchiveRestorePlan,
  input: ArchiveRestoreInput,
) {
  const products = new Map(graph.local.map((product) => [product.id, product]));
  const decisions = new Map(input.decisions.map((decision) => [decision.productId, decision]));
  const nodes = new Map(plan.dependencies.map((node) => [node.id, node]));
  if (
    decisions.size !== input.decisions.length ||
    input.decisions.some((decision) => !nodes.has(decision.productId))
  )
    throw new BadRequestException("План содержит повторяющиеся или неизвестные решения");
  const usedDecisions = new Set<string>();
  const validateDecision = (productId: string) => {
    const node = nodes.get(productId)!;
    const decision = decisions.get(productId);
    if (!decision)
      throw new BadRequestException(
        "Выберите действие для каждой необходимой архивной зависимости",
      );
    if (decision.action === "REPLACE") {
      if (
        node.type === "GARNISH" &&
        node.parentIds.some((parentId) =>
          products
            .get(parentId)!
            .cocktailGarnishes.some((row) => row.garnishId === decision.replacementProductId),
        )
      ) {
        throw new ConflictException(
          "Выбранный гарнир уже указан в восстанавливаемом коктейле. Выберите другой гарнир",
        );
      }
      if (
        !node.replacements.some((replacement) => replacement.id === decision.replacementProductId)
      )
        throw new BadRequestException("Выберите допустимую активную замену");
      if (decision.newName)
        throw new BadRequestException("Замена не изменяет название активной карточки");
    } else if (decision.action !== "RESTORE" || decision.replacementProductId)
      throw new BadRequestException("Недопустимое решение восстановления");
    usedDecisions.add(productId);
    return decision;
  };
  const restored = new Map<string, string>();
  const replacements: Array<{
    parentId: string;
    rowId: string;
    productId: string;
    replacementProductId: string;
    garnish: boolean;
  }> = [];
  const walk = (id: string, newName?: string) => {
    if (restored.has(id)) return;
    const product = products.get(id)!;
    const name = (newName ?? product.name).trim().replace(/\s+/gu, " ");
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
        message: "Название уже занято. Укажите другое название восстанавливаемой карточки",
        productId: id,
      });
    restored.set(id, name);
    for (const link of productLinks(product)) {
      const child = products.get(link.productId);
      if (!child || child.status !== "ARCHIVED") continue;
      const decision = validateDecision(child.id);
      if (decision.action === "RESTORE") walk(child.id, decision.newName);
      else
        replacements.push({
          parentId: id,
          ...link,
          replacementProductId: decision.replacementProductId!,
        });
    }
  };
  walk(plan.root.id, input.newName);
  if (input.decisions.some((decision) => !usedDecisions.has(decision.productId))) {
    throw new BadRequestException(
      "Не передавайте решения для компонентов заменённой карточки: они не участвуют в восстановлении",
    );
  }
  const finalLinks = new Map<string, string[]>();
  for (const product of graph.local.filter(
    (item) => item.status === "ACTIVE" || restored.has(item.id),
  )) {
    const finalGarnishIds = new Set<string>();
    finalLinks.set(
      product.id,
      productLinks(product).map((link) => {
        const replacement = replacements.find(
          (item) => item.parentId === product.id && item.rowId === link.rowId,
        );
        const targetId = replacement?.replacementProductId ?? link.productId;
        const target = products.get(targetId);
        if (target && target.status !== "ACTIVE" && !restored.has(targetId))
          throw new ConflictException("В составе остаётся архивная зависимость");
        if (link.garnish) {
          if (target?.type !== "GARNISH" || product.type !== "COCKTAIL")
            throw new ConflictException("Недопустимый гарнир");
          if (finalGarnishIds.has(targetId))
            throw new ConflictException(
              `Гарнир «${target.name}» выбран несколько раз для коктейля «${product.name}». Выберите разные гарниры`,
            );
          finalGarnishIds.add(targetId);
        } else if (target) assertAllowedComponent(product.type, target.type);
        return targetId;
      }),
    );
    if (restored.has(product.id)) {
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
    }
  }
  const complete = new Set<string>();
  const visit = (id: string, path: Set<string>) => {
    if (path.has(id)) throw new ConflictException("Выбранная замена создаёт цикл зависимостей");
    if (complete.has(id)) return;
    path.add(id);
    for (const child of finalLinks.get(id) ?? []) visit(child, path);
    path.delete(id);
    complete.add(id);
  };
  for (const id of restored.keys()) visit(id, new Set());
  return { restored, replacements };
}
