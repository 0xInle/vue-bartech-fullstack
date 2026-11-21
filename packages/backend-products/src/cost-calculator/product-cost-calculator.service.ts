import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE_CLIENT, Prisma, type PrismaClient } from "@bartech/database";
import { ProductContextAccess } from "../product-context-access.js";
import type { CreateProductContext } from "../product.dto.js";
import type {
  CostCalculationInput,
  CostCalculationResult,
  CostCalculatorRecipe,
  CostCalculatorProduct,
  CostCalculatorUnit,
} from "./product-cost-calculator.dto.js";

const productSelect = {
  id: true,
  name: true,
  type: true,
  venueId: true,
  status: true,
  outputAmount: true,
  outputUnit: { select: { id: true, code: true, label: true, kind: true, venueId: true } },
  parentComponents: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      amount: true,
      componentProductId: true,
      componentVenueId: true,
      unit: { select: { id: true, code: true, label: true, kind: true, venueId: true } },
    },
  },
  cocktailGarnishes: {
    orderBy: { position: "asc" },
    select: { garnishId: true, garnishVenueId: true },
  },
  cocktailQuickGarnishes: {
    orderBy: { position: "asc" },
    select: { referenceValue: { select: { id: true, label: true, venueId: true } } },
  },
} satisfies Prisma.ProductSelect;
const accountingPriceUnits = {
  kg: "MASS",
  l: "VOLUME",
  pc: "COUNT",
} as const;

type ResultLine = CostCalculationResult["lines"][number];

@Injectable()
export class ProductCostCalculatorService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: PrismaClient,
    private readonly access: ProductContextAccess,
  ) {}

  async getRecipe(context: CreateProductContext, productId: string): Promise<CostCalculatorRecipe> {
    await this.access.assert(context, "view_products");
    const [product, units, priceUnits] = await Promise.all([
      this.loadProduct(context.venueId, productId, true, []),
      this.database.unit.findMany({
        where: { OR: [{ venueId: null }, { venueId: context.venueId }] },
        orderBy: [{ venueId: "asc" }, { label: "asc" }],
        select: { id: true, code: true, label: true, kind: true },
      }),
      this.database.unit.findMany({
        where: { venueId: null, code: { in: Object.keys(accountingPriceUnits) } },
        orderBy: { label: "asc" },
        select: { id: true, code: true, label: true, kind: true },
      }),
    ]);
    return { product, units: units.map(unitDto), priceUnits: priceUnits.map(unitDto) };
  }

  async calculate(
    context: CreateProductContext,
    productId: string,
    input: CostCalculationInput,
  ): Promise<CostCalculationResult> {
    const { product: recipe, units: availableUnits } = await this.getRecipe(context, productId);
    validateInput(input);

    const priceUnitIds = [
      ...input.ingredientInputs.flatMap((entry) =>
        entry.mode === "UNIT_PRICE" ? [entry.priceUnitId] : [],
      ),
      ...input.quickGarnishes.flatMap((entry) =>
        entry.mode === "UNIT_PRICE" ? [entry.priceUnitId] : [],
      ),
    ];
    const unitIds = [
      ...priceUnitIds,
      ...input.quickGarnishes.flatMap((entry) =>
        entry.mode === "UNIT_PRICE" ? [entry.unitId] : [],
      ),
    ];
    const units = await this.getUnits(context.venueId, unitIds, priceUnitIds);
    const ingredientInputs = new Map(input.ingredientInputs.map((entry) => [entry.lineKey, entry]));
    const quickInputs = new Map(input.quickGarnishes.map((entry) => [entry.id, entry]));
    const validIngredientKeys = new Set<string>();
    const validQuickIds = new Set(
      recipe.garnishes.filter((item) => item.kind === "QUICK").map((item) => item.id),
    );
    const lines: ResultLine[] = [];
    const issues: string[] = [];

    const visit = (node: CostCalculatorProduct, scale: number, path: string[]): void => {
      for (const component of node.components) {
        const nextPath = [...path, component.id];
        const lineKey = nextPath.join(".");
        if (component.product.type === "INGREDIENT") {
          validIngredientKeys.add(lineKey);
          const amount = component.amount * scale;
          const inputForLine = ingredientInputs.get(lineKey);
          if (inputForLine && inputForLine.mode !== "UNIT_PRICE") {
            if (hasCompatibleAccountingUnit(component.unit)) {
              throw new BadRequestException("Для единицы расхода доступен обычный расчёт цены");
            }
            const omitted = inputForLine.mode === "OMIT";
            const issue = omitted ? `${component.product.name}: стоимость не учтена` : null;
            lines.push({
              lineKey,
              name: component.product.name,
              amount,
              unit: component.unit,
              cost: omitted ? null : roundMoney(inputForLine.estimatedCost),
              estimated: !omitted,
              issue,
            });
            if (issue) issues.push(issue);
            continue;
          }
          const priceUnit =
            inputForLine?.mode === "UNIT_PRICE" ? units.get(inputForLine.priceUnitId) : undefined;
          const converted =
            inputForLine?.mode === "UNIT_PRICE" && priceUnit
              ? convertAmount(amount, component.unit, priceUnit)
              : null;
          const cost =
            inputForLine?.mode === "UNIT_PRICE" && converted !== null
              ? roundMoney(converted * inputForLine.unitPrice)
              : null;
          const issue = !inputForLine
            ? hasCompatibleAccountingUnit(component.unit)
              ? "Укажите цену за единицу и единицу цены"
              : "Выберите примерную стоимость или исключите строку"
            : converted === null
              ? "Невозможно автоматически пересчитать единицы"
              : null;
          lines.push({
            lineKey,
            name: component.product.name,
            amount,
            unit: component.unit,
            cost,
            estimated: false,
            issue,
          });
          if (issue) issues.push(`${component.product.name}: ${issue}`);
          continue;
        }

        const child = component.product;
        if (!child.output) {
          const issue = `${child.name}: не указан фактический выход`;
          lines.push({
            lineKey,
            name: child.name,
            amount: component.amount * scale,
            unit: component.unit,
            cost: null,
            estimated: false,
            issue,
          });
          issues.push(issue);
          continue;
        }
        const childAmount = convertAmount(component.amount, component.unit, child.output.unit);
        if (childAmount === null) {
          const issue = `${child.name}: невозможно автоматически пересчитать в ${child.output.unit.label}`;
          lines.push({
            lineKey,
            name: child.name,
            amount: component.amount * scale,
            unit: component.unit,
            cost: null,
            estimated: false,
            issue,
          });
          issues.push(issue);
          continue;
        }
        visit(child, (scale * childAmount) / child.output.amount, nextPath);
      }
    };

    visit(recipe, 1, []);
    if (recipe.components.length === 0) issues.push(`${recipe.name}: состав не задан`);
    for (const key of ingredientInputs.keys()) {
      if (!validIngredientKeys.has(key))
        throw new BadRequestException("Строка ингредиента больше не входит в выбранный продукт");
    }
    if (recipe.type === "COCKTAIL") {
      for (const garnish of recipe.garnishes) {
        if (garnish.kind === "PRODUCT") {
          const output = garnish.product.output;
          if (!output || output.unit.kind !== "COUNT") {
            const issue = `${garnish.name}: укажите фактический выход в штуках`;
            lines.push({
              lineKey: `garnish-${garnish.id}`,
              name: garnish.name,
              amount: null,
              unit: null,
              cost: null,
              estimated: false,
              issue,
            });
            issues.push(issue);
          } else {
            visit(garnish.product, 1 / output.amount, [`garnish-${garnish.id}`]);
          }
          continue;
        }
        const garnishInput = quickInputs.get(garnish.id);
        if (!garnishInput || garnishInput.mode === "OMIT") {
          const issue = `${garnish.name}: стоимость не учтена`;
          lines.push({
            lineKey: `garnish-${garnish.id}`,
            name: garnish.name,
            amount: null,
            unit: null,
            cost: null,
            estimated: false,
            issue,
          });
          issues.push(issue);
        } else if (garnishInput.mode === "ESTIMATE") {
          lines.push({
            lineKey: `garnish-${garnish.id}`,
            name: garnish.name,
            amount: 1,
            unit: null,
            cost: roundMoney(garnishInput.estimatedPrice),
            estimated: true,
            issue: null,
          });
        } else {
          const recipeUnit = units.get(garnishInput.unitId);
          const priceUnit = units.get(garnishInput.priceUnitId);
          const converted =
            recipeUnit &&
            priceUnit &&
            recipeUnit.kind === priceUnit.kind &&
            (recipeUnit.kind === "MASS" || recipeUnit.kind === "COUNT")
              ? convertAmount(garnishInput.amount, recipeUnit, priceUnit)
              : null;
          const issue =
            converted === null
              ? `${garnish.name}: невозможно автоматически пересчитать единицы`
              : null;
          lines.push({
            lineKey: `garnish-${garnish.id}`,
            name: garnish.name,
            amount: garnishInput.amount,
            unit: recipeUnit ?? null,
            cost: converted === null ? null : roundMoney(converted * garnishInput.unitPrice),
            estimated: false,
            issue,
          });
          if (issue) issues.push(issue);
        }
      }
    }

    if (recipe.type !== "COCKTAIL" && !recipe.output) {
      issues.push(`${recipe.name}: фактический выход не указан, стоимость единицы не рассчитана`);
    }

    for (const id of quickInputs.keys()) {
      if (!validQuickIds.has(id))
        throw new BadRequestException("Гарнировка больше не входит в выбранный коктейль");
    }
    const totalCost = roundMoney(lines.reduce((sum, line) => sum + (line.cost ?? 0), 0));
    return {
      productId: recipe.id,
      productName: recipe.name,
      productType: recipe.type as "PREPARATION" | "GARNISH" | "COCKTAIL",
      totalCost,
      costPerOutputUnit:
        recipe.type !== "COCKTAIL" && recipe.output
          ? roundMoney(totalCost / recipe.output.amount)
          : null,
      output: recipe.output,
      units: availableUnits,
      complete: issues.length === 0,
      hasEstimates: lines.some((line) => line.estimated),
      lines,
      issues: [...new Set(issues)],
    };
  }

  private async loadProduct(
    venueId: string,
    productId: string,
    root: boolean,
    ancestors: string[],
  ): Promise<CostCalculatorProduct> {
    if (ancestors.includes(productId))
      throw new BadRequestException("В техкарте обнаружена циклическая зависимость");
    const record = await this.database.product.findFirst({
      where: root
        ? {
            id: productId,
            venueId,
            status: "ACTIVE",
            type: { in: ["COCKTAIL", "PREPARATION", "GARNISH"] },
          }
        : {
            id: productId,
            status: "ACTIVE",
            OR: [{ venueId }, { venueId: null, type: "INGREDIENT" }],
          },
      select: productSelect,
    });
    if (!record) throw new NotFoundException("Продукт недоступен для расчёта");
    if (
      !root &&
      record.type !== "INGREDIENT" &&
      record.type !== "PREPARATION" &&
      record.type !== "GARNISH"
    ) {
      throw new BadRequestException("В составе найден неподдерживаемый тип продукта");
    }
    const nextAncestors = [...ancestors, productId];
    const components = await Promise.all(
      record.parentComponents.map(async (component) => {
        assertUnitScope(component.unit, venueId);
        if (component.componentVenueId !== null && component.componentVenueId !== venueId) {
          throw new NotFoundException("Компонент недоступен в текущем заведении");
        }
        const product = await this.loadProduct(
          venueId,
          component.componentProductId,
          false,
          nextAncestors,
        );
        return {
          id: component.id,
          amount: Number(component.amount),
          unit: unitDto(component.unit),
          product,
        };
      }),
    );
    const garnishes: CostCalculatorProduct["garnishes"] = [];
    if (record.type === "COCKTAIL") {
      for (const garnish of record.cocktailGarnishes) {
        if (garnish.garnishVenueId !== venueId)
          throw new NotFoundException("Гарнир недоступен в текущем заведении");
        const product = await this.loadProduct(venueId, garnish.garnishId, false, nextAncestors);
        garnishes.push({ id: garnish.garnishId, name: product.name, kind: "PRODUCT", product });
      }
      for (const garnish of record.cocktailQuickGarnishes) {
        if (garnish.referenceValue.venueId !== null && garnish.referenceValue.venueId !== venueId) {
          throw new NotFoundException("Гарнировка недоступна в текущем заведении");
        }
        garnishes.push({
          id: garnish.referenceValue.id,
          name: garnish.referenceValue.label,
          kind: "QUICK",
        });
      }
    }
    if (record.outputUnit) assertUnitScope(record.outputUnit, venueId);
    return {
      id: record.id,
      name: record.name,
      type: record.type,
      output:
        record.outputAmount && record.outputUnit
          ? { amount: Number(record.outputAmount), unit: unitDto(record.outputUnit) }
          : null,
      components,
      garnishes,
    };
  }

  private async getUnits(
    venueId: string,
    ids: string[],
    priceUnitIds: string[],
  ): Promise<Map<string, CostCalculatorUnit>> {
    const uniqueIds = [...new Set(ids)];
    const priceIds = new Set(priceUnitIds);
    const records = uniqueIds.length
      ? await this.database.unit.findMany({
          where: { id: { in: uniqueIds }, OR: [{ venueId: null }, { venueId }] },
          select: { id: true, code: true, label: true, kind: true, venueId: true },
        })
      : [];
    for (const record of records) {
      if (!priceIds.has(record.id)) continue;
      if (
        record.venueId !== null ||
        accountingPriceUnits[record.code as keyof typeof accountingPriceUnits] !== record.kind
      ) {
        throw new BadRequestException("Цена должна быть указана за килограмм, литр или штуку");
      }
    }
    const result = new Map(records.map((unit) => [unit.id, unitDto(unit)]));
    if (result.size !== uniqueIds.length)
      throw new BadRequestException("Выбрана недоступная единица измерения");
    return result;
  }
}

function validateInput(input: CostCalculationInput): void {
  const unique = <T>(items: T[], key: (item: T) => string): boolean =>
    new Set(items.map(key)).size === items.length;
  if (!unique(input.ingredientInputs, (item) => item.lineKey))
    throw new BadRequestException("Строка ингредиента передана повторно");
  if (!unique(input.quickGarnishes, (item) => item.id))
    throw new BadRequestException("Гарнировка передана повторно");
  for (const entry of input.ingredientInputs) {
    if (entry.mode === "UNIT_PRICE" && (!entry.priceUnitId || !nonNegative(entry.unitPrice)))
      throw new BadRequestException("Проверьте цену за единицу");
    if (entry.mode === "ESTIMATE" && !nonNegative(entry.estimatedCost))
      throw new BadRequestException("Укажите примерную стоимость строки");
  }
  for (const entry of input.quickGarnishes) {
    if (entry.mode === "ESTIMATE" && !nonNegative(entry.estimatedPrice))
      throw new BadRequestException("Оценочная стоимость не может быть отрицательной");
    if (
      entry.mode === "UNIT_PRICE" &&
      (!positive(entry.amount) ||
        !entry.unitId ||
        !entry.priceUnitId ||
        !nonNegative(entry.unitPrice))
    ) {
      throw new BadRequestException("Проверьте количество гарнировки и цену за единицу");
    }
  }
}

function hasCompatibleAccountingUnit(unit: CostCalculatorUnit): boolean {
  return Object.entries(accountingPriceUnits).some(
    ([code, kind]) =>
      unit.kind === kind && automaticFactor(unit, { id: "", code, label: "", kind }),
  );
}

function unitDto(unit: {
  id: string;
  code: string;
  label: string;
  kind: CostCalculatorUnit["kind"];
}): CostCalculatorUnit {
  return { id: unit.id, code: unit.code, label: unit.label, kind: unit.kind };
}

function assertUnitScope(unit: { venueId: string | null }, venueId: string): void {
  if (unit.venueId !== null && unit.venueId !== venueId) {
    throw new NotFoundException("Единица измерения недоступна в текущем заведении");
  }
}

function convertAmount(
  amount: number,
  from: CostCalculatorUnit,
  to: CostCalculatorUnit,
): number | null {
  const factor = automaticFactor(from, to);
  return factor === null ? null : amount * factor;
}

function automaticFactor(from: CostCalculatorUnit, to: CostCalculatorUnit): number | null {
  if (from.id === to.id) return 1;
  if (from.kind !== to.kind || !from.kind || !["VOLUME", "MASS", "COUNT"].includes(from.kind))
    return null;
  const factors: Record<string, number> = { ml: 1, l: 1000, g: 1, kg: 1000, pc: 1 };
  const fromFactor = factors[from.code];
  const toFactor = factors[to.code];
  return fromFactor === undefined || toFactor === undefined ? null : fromFactor / toFactor;
}

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function nonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
