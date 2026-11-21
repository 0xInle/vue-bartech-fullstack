<template>
  <section class="w-full min-w-0 rounded-lg border border-[var(--p-content-border-color)] p-2">
    <header class="flex items-center gap-2">
      <i class="pi pi-calculator text-sm text-primary" aria-hidden="true" />
      <h2 class="min-w-0 flex-1 text-sm font-semibold">Калькулятор себестоимости</h2>
      <Button
        :icon="collapsed ? 'pi pi-chevron-down' : 'pi pi-chevron-up'"
        :aria-label="collapsed ? 'Развернуть калькулятор' : 'Свернуть калькулятор'"
        :aria-expanded="!collapsed"
        size="small"
        severity="secondary"
        variant="text"
        class="workspace-action-icon-button"
        @click="collapsed = !collapsed"
      />
    </header>

    <Transition name="dashboard-collapse">
      <div v-if="!collapsed" class="dashboard-collapse">
        <div class="space-y-3">
          <div>
            <FloatLabel variant="on">
              <AutoComplete
                v-model="selectedProduct"
                input-id="cost-calculator-product"
                :suggestions="suggestions"
                option-label="name"
                show-clear
                size="small"
                class="w-full"
                fluid
                :force-selection="false"
                :delay="250"
                :min-length="2"
                :loading="searchLoading"
                :show-empty-message="searchLoading || searchHasNoResults"
                @update:model-value="updateProductSearch"
                @item-select="selectProduct"
                @clear="clearProduct"
              >
                <template #empty>
                  <LoadingIndicator v-if="searchLoading" class="w-auto" />
                  <Message
                    v-else-if="searchHasNoResults"
                    severity="secondary"
                    size="small"
                    :closable="false"
                    :pt="compactMessagePt"
                  >
                    По вашему запросу ничего не найдено
                  </Message>
                </template>
              </AutoComplete>
              <label for="cost-calculator-product" class="text-xs"
                >Коктейль, заготовка или гарнир</label
              >
            </FloatLabel>
          </div>

          <Message
            v-if="searchError"
            severity="error"
            size="small"
            :closable="false"
            :pt="compactMessagePt"
          >
            {{ searchError }}
          </Message>
          <Message
            v-if="loadError"
            severity="error"
            size="small"
            :closable="false"
            :pt="compactMessagePt"
          >
            Не удалось загрузить техкарту.
            <Button label="Повторить" size="small" text @click="recipeQuery.refetch()" />
          </Message>
          <Message
            v-if="mutationError"
            severity="error"
            size="small"
            :closable="false"
            :pt="compactMessagePt"
          >
            {{ mutationError }}
          </Message>
          <LoadingIndicator v-if="recipeQuery.isLoading.value" />

          <template v-if="recipe">
            <div class="min-w-0">
              <div class="cost-calculator-rows text-sm">
                <div
                  class="cost-calculator-grid cost-calculator-header text-xs text-color-secondary"
                  :class="{ 'cost-calculator-grid-with-sum': result }"
                >
                  <span>Ингредиент</span>
                  <span>Цена</span>
                  <span>Ед. изм.</span>
                  <span v-if="result">Сумма</span>
                </div>
                <div v-if="tableRows.length === 0" class="py-2 text-xs text-color-secondary">
                  В техкарте нет ингредиентов.
                </div>
                <template v-for="data in tableRows" :key="data.key">
                  <div
                    class="cost-calculator-grid cost-calculator-row"
                    :class="{ 'cost-calculator-grid-with-sum': result }"
                  >
                    <div class="min-w-0">
                      <div class="flex min-w-0 items-center gap-1">
                        <span
                          class="min-w-0 truncate"
                          :class="data.kind === 'ISSUE' ? 'text-color-secondary' : 'font-normal'"
                          :title="data.name"
                        >
                          {{ data.name }}
                        </span>
                        <Tag
                          v-if="resultLine(data.key)?.estimated"
                          value="Оценка"
                          severity="secondary"
                          :pt="compactTagPt"
                          class="shrink-0"
                        />
                        <Button
                          v-if="data.kind === 'QUICK_GARNISH' || unsupportedIngredient(data)"
                          icon="pi pi-chevron-down"
                          :aria-label="`Выбрать способ расчёта: ${data.name}`"
                          aria-haspopup="true"
                          size="small"
                          severity="secondary"
                          variant="text"
                          class="cost-calculator-mode-button shrink-0"
                          @click="openCalculationMenu($event, data)"
                        />
                      </div>
                      <template v-if="data.kind === 'QUICK_GARNISH'">
                        <span
                          v-if="quickInputs[data.id]!.mode === 'UNIT_PRICE'"
                          class="block text-xs text-color-secondary"
                        >
                          1 шт
                        </span>
                        <span v-else />
                      </template>
                      <span
                        v-else-if="data.amount !== null"
                        class="block text-xs text-color-secondary"
                      >
                        {{ formatAmount(data.amount) }} {{ data.unit?.label }}
                      </span>
                      <span v-else class="block text-xs text-color-secondary">—</span>
                      <span
                        v-if="data.kind === 'ISSUE'"
                        class="block truncate text-xs text-color-secondary"
                        :title="data.issue"
                      >
                        {{ data.issue }}
                      </span>
                    </div>
                    <div class="min-w-0">
                      <InputNumber
                        v-if="data.kind === 'INGREDIENT' && ingredientMode(data) === 'UNIT_PRICE'"
                        v-model="ingredientInputs[data.key]!.unitPrice"
                        :aria-label="`Цена: ${data.name}`"
                        size="small"
                        :min="0"
                        :min-fraction-digits="0"
                        :max-fraction-digits="2"
                        locale="ru-RU"
                        class="w-[110px] max-w-full"
                      />
                      <InputNumber
                        v-else-if="
                          data.kind === 'INGREDIENT' && ingredientMode(data) === 'ESTIMATE'
                        "
                        v-model="ingredientInputs[data.key]!.estimatedCost"
                        :aria-label="`Примерная стоимость: ${data.name}`"
                        size="small"
                        :min="0"
                        :min-fraction-digits="0"
                        :max-fraction-digits="2"
                        locale="ru-RU"
                        :invalid="calculationAttempted && ingredientEstimateInvalid(data)"
                        class="w-[110px] max-w-full"
                      />
                      <InputNumber
                        v-else-if="quickUnitPriceEnabled(data)"
                        :model-value="quickInputs[data.id]!.unitPrice"
                        :aria-label="`Цена: ${data.name}`"
                        size="small"
                        :min="0"
                        :min-fraction-digits="0"
                        :max-fraction-digits="2"
                        locale="ru-RU"
                        class="w-[110px] max-w-full"
                        @update:model-value="updateQuickPrice(data.id, $event)"
                      />
                      <InputNumber
                        v-else-if="
                          data.kind === 'QUICK_GARNISH' && quickInputs[data.id]!.mode === 'ESTIMATE'
                        "
                        v-model="quickInputs[data.id]!.unitPrice"
                        :aria-label="`Примерная цена: ${data.name}`"
                        size="small"
                        :min="0"
                        :min-fraction-digits="0"
                        :max-fraction-digits="2"
                        locale="ru-RU"
                        class="w-[110px] max-w-full"
                        @update:model-value="updateQuickPrice(data.id, $event)"
                      />
                      <span v-else />
                    </div>
                    <div class="min-w-0">
                      <Select
                        v-if="data.kind === 'INGREDIENT' && ingredientMode(data) === 'UNIT_PRICE'"
                        v-model="ingredientInputs[data.key]!.priceUnitId"
                        :options="priceUnits"
                        option-label="label"
                        option-value="id"
                        :aria-label="`Единица измерения цены: ${data.name}`"
                        size="small"
                        :invalid="calculationAttempted && ingredientUnitInvalid(data)"
                        class="w-[90px] max-w-full"
                      />
                      <Select
                        v-else-if="quickUnitPriceEnabled(data)"
                        :model-value="quickInputs[data.id]!.priceUnitId"
                        :options="quickPriceUnits(data.id)"
                        option-label="label"
                        option-value="id"
                        :aria-label="`Единица измерения цены: ${data.name}`"
                        size="small"
                        :invalid="calculationAttempted && quickGarnishUnitInvalid(data)"
                        class="w-[90px] max-w-full"
                        @update:model-value="updateQuickPriceUnit(data.id, $event)"
                      />
                      <span v-else />
                    </div>
                    <div
                      v-if="result"
                      class="flex min-w-0 items-center justify-start gap-1 whitespace-nowrap"
                    >
                      <InputNumber
                        v-if="showResultValue(data)"
                        :model-value="resultLine(data.key)?.cost ?? null"
                        :aria-label="`Сумма: ${data.name}`"
                        size="small"
                        readonly
                        locale="ru-RU"
                        :min-fraction-digits="2"
                        :max-fraction-digits="2"
                        class="w-20"
                      />
                    </div>
                  </div>
                </template>
              </div>
              <Menu
                ref="quickGarnishMenu"
                :model="calculationMenuItems"
                popup
                class="min-w-48"
                :pt="{ itemContent: { class: 'text-sm' }, itemLabel: { class: 'text-sm' } }"
              />
            </div>

            <div
              class="flex items-center justify-between gap-3 border-t border-[var(--p-content-border-color)] pt-2"
            >
              <div v-if="result" class="min-w-0">
                <p class="text-sm font-semibold">
                  {{
                    result.complete
                      ? recipe.product.type === "COCKTAIL"
                        ? "Себестоимость порции"
                        : "Стоимость выхода"
                      : "Сумма"
                  }}: {{ money(result.totalCost) }} ₽
                  <Tag
                    v-if="result.hasEstimates"
                    value="Есть оценки"
                    severity="secondary"
                    :pt="compactTagPt"
                    class="ml-1 align-middle"
                  />
                </p>
              </div>
              <Button
                label="Рассчитать"
                size="small"
                class="ml-auto shrink-0"
                :loading="calculateMutation.isPending.value"
                :disabled="calculateMutation.isPending.value"
                @click="calculate"
              />
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useQuery, useMutation } from "@tanstack/vue-query";
import type {
  CostCalculationRequestDto,
  CostCalculationResponseDto,
  CostCalculatorProductResponseDto,
  CostCalculatorRecipeResponseDto,
} from "@bartech/api-client";
import {
  productsControllerCalculateCost,
  productsControllerGetCostCalculatorRecipe,
} from "@bartech/api-client";
import Menu from "primevue/menu";
import type { Workspace } from "~/types/user-workspaces";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import {
  useWorkspaceProductSearch,
  type WorkspaceSearchItem,
} from "../composables/useWorkspaceProductSearch";
import { requestApi } from "~/utils/api-response";
import { compactMessagePt } from "~/utils/primevue-message";

const props = defineProps<{ workspace: Workspace }>();
const collapsed = ref(false);
const identity = useIdentityFlow();
const calculatorProductTypes = ["COCKTAIL", "PREPARATION", "GARNISH"] as const;
const { debouncedSearch, productQuery, searchText } = useWorkspaceProductSearch(
  () => props.workspace,
  { types: calculatorProductTypes },
);
type SearchItem = WorkspaceSearchItem;
type IngredientRow = {
  key: string;
  name: string;
  amount: number;
  unit: CostCalculatorProductResponseDto["components"][number]["unit"];
  kind: "INGREDIENT";
};
type IssueRow = {
  key: string;
  name: string;
  amount: number | null;
  unit: IngredientRow["unit"] | null;
  issue: string;
  kind: "ISSUE";
};
type QuickGarnishRow = { key: string; id: string; name: string; kind: "QUICK_GARNISH" };
type ComponentRow = IngredientRow | IssueRow;
type CalculatorTableRow = ComponentRow | QuickGarnishRow;
type TemporaryIngredient = {
  mode?: "UNIT_PRICE" | "ESTIMATE" | "OMIT";
  priceUnitId?: string;
  unitPrice?: number;
  estimatedCost?: number;
};
type TemporaryQuickGarnish = {
  mode: "UNIT_PRICE" | "ESTIMATE" | "OMIT";
  amount?: number;
  unitId?: string;
  unitPrice?: number;
  priceUnitId?: string;
};

const selectedProduct = ref<SearchItem | string | null>(null);
const selectedId = ref("");
const quickGarnishMenu = ref<InstanceType<typeof Menu> | null>(null);
const activeCalculationMenu = ref<{ kind: "INGREDIENT" | "QUICK_GARNISH"; id: string } | null>(
  null,
);
const calculationMenuItems = computed(() =>
  activeCalculationMenu.value?.kind === "QUICK_GARNISH"
    ? [
        { label: "Цена за ед. изм.", command: () => setQuickGarnishMode("UNIT_PRICE") },
        { label: "Примерная цена", command: () => setQuickGarnishMode("ESTIMATE") },
        { label: "Не учитывать", command: () => setQuickGarnishMode("OMIT") },
      ]
    : [
        { label: "Примерная стоимость", command: () => setIngredientMode("ESTIMATE") },
        { label: "Не учитывать", command: () => setIngredientMode("OMIT") },
      ],
);
const suggestions = computed(() => {
  if (searchText.value.trim() !== debouncedSearch.value) return [];
  return (productQuery.data.value?.items ?? []).filter(
    (item) =>
      item.scope === "VENUE" &&
      item.venueId === props.workspace.venue.id &&
      ["COCKTAIL", "PREPARATION", "GARNISH"].includes(item.type),
  );
});
const searchLoading = computed(
  () =>
    searchText.value.trim().length >= 2 &&
    (searchText.value.trim() !== debouncedSearch.value || productQuery.isFetching.value),
);
const searchHasNoResults = computed(
  () =>
    searchText.value.trim().length >= 2 &&
    searchText.value.trim() === debouncedSearch.value &&
    productQuery.isSuccess.value &&
    !productQuery.isFetching.value &&
    !productQuery.isError.value &&
    suggestions.value.length === 0,
);
const searchError = computed(() => {
  if (!productQuery.isError.value) return "";
  const error = productQuery.error.value;
  return error instanceof Error ? error.message : "Не удалось выполнить поиск продукции.";
});
const ingredientInputs = ref<Record<string, TemporaryIngredient>>({});
const quickInputs = ref<Record<string, TemporaryQuickGarnish>>({});
const calculationAttempted = ref(false);
const result = ref<CostCalculationResponseDto | null>(null);
const resultLines = computed(
  () => new Map(result.value?.lines.map((line) => [line.lineKey, line]) ?? []),
);
const mutationError = ref("");

watch(
  selectedProduct,
  (value) => {
    selectedId.value = value && typeof value === "object" ? value.id : "";
  },
  { flush: "sync" },
);

const recipeQuery = useQuery({
  queryKey: computed(() => [
    "product-cost-calculator-recipe",
    props.workspace.company.id,
    props.workspace.venue.id,
    selectedId.value,
  ]),
  enabled: computed(() => Boolean(selectedId.value)),
  retry: false,
  queryFn: async (): Promise<CostCalculatorRecipeResponseDto> =>
    requestApi(
      Promise.resolve(
        await productsControllerGetCostCalculatorRecipe(
          props.workspace.company.id,
          props.workspace.venue.id,
          selectedId.value,
          { credentials: "include" },
          identity.apiFetch,
        ),
      ),
    ),
});
const recipe = computed(() => recipeQuery.data.value);
const priceUnits = computed(() => recipe.value?.priceUnits ?? []);
const loadError = computed(() => recipeQuery.isError.value);
const calculateMutation = useMutation({
  mutationFn: async (input: CostCalculationRequestDto): Promise<CostCalculationResponseDto> => {
    await identity.refreshCsrf();
    return requestApi(
      Promise.resolve(
        await productsControllerCalculateCost(
          props.workspace.company.id,
          props.workspace.venue.id,
          selectedId.value,
          input,
          { credentials: "include", headers: { "x-csrf-token": identity.csrfToken.value } },
          identity.apiFetch,
        ),
      ),
    );
  },
  onSuccess: (value) => (result.value = value),
  onError: (error) =>
    (mutationError.value = error instanceof Error ? error.message : "Не удалось выполнить расчёт."),
});

const quickGarnishRows = computed(
  () => recipe.value?.product.garnishes.filter((item) => item.kind === "QUICK") ?? [],
);
const componentRows = computed<ComponentRow[]>(() => {
  if (!recipe.value) return [];
  const rows: ComponentRow[] = [];
  const walk = (node: CostCalculatorProductResponseDto, scale: number, path: string[]) => {
    for (const component of node.components) {
      const nextPath = [...path, component.id];
      const key = nextPath.join(".");
      if (component.product.type === "INGREDIENT") {
        rows.push({
          key,
          name: component.product.name,
          amount: component.amount * scale,
          unit: component.unit,
          kind: "INGREDIENT",
        });
      } else if (!component.product.output) {
        rows.push({
          key,
          name: component.product.name,
          amount: component.amount * scale,
          unit: component.unit,
          issue: "Не указан фактический выход",
          kind: "ISSUE",
        });
      } else {
        const factor = automaticFactor(component.unit, component.product.output.unit);
        if (factor === null)
          rows.push({
            key,
            name: component.product.name,
            amount: component.amount * scale,
            unit: component.unit,
            issue: `Нужен пересчёт в ${component.product.output.unit.label}`,
            kind: "ISSUE",
          });
        else
          walk(
            component.product,
            (scale * component.amount * factor) / component.product.output.amount,
            nextPath,
          );
      }
    }
  };
  walk(recipe.value.product, 1, []);
  for (const garnish of recipe.value.product.garnishes) {
    if (garnish.kind !== "PRODUCT") continue;
    const output = garnish.product.output;
    if (!output || output.unit.kind !== "COUNT") {
      rows.push({
        key: `garnish-${garnish.id}`,
        name: garnish.name,
        amount: null,
        unit: null,
        issue: "Укажите фактический выход в штуках",
        kind: "ISSUE",
      });
      continue;
    }
    walk(garnish.product, 1 / output.amount, [`garnish-${garnish.id}`]);
  }
  return rows;
});
const tableRows = computed<CalculatorTableRow[]>(() => [
  ...componentRows.value,
  ...quickGarnishRows.value.map((garnish) => ({
    key: `garnish-${garnish.id}`,
    id: garnish.id,
    name: garnish.name,
    kind: "QUICK_GARNISH" as const,
  })),
]);
watch(
  () => [props.workspace.company.id, props.workspace.venue.id],
  () => clearProduct(),
);
watch(selectedId, () => {
  result.value = null;
  calculationAttempted.value = false;
  mutationError.value = "";
  ingredientInputs.value = {};
  quickInputs.value = {};
});
watch(recipe, (value) => {
  if (!value) return;
  const ingredients: Record<string, TemporaryIngredient> = {};
  const visit = (node: CostCalculatorProductResponseDto, path: string[]) => {
    for (const component of node.components) {
      const next = [...path, component.id];
      if (component.product.type === "INGREDIENT") {
        ingredients[next.join(".")] = {
          mode: compatiblePriceUnit(component.unit) ? "UNIT_PRICE" : undefined,
          priceUnitId: compatiblePriceUnit(component.unit)?.id,
        };
      } else visit(component.product, next);
    }
  };
  visit(value.product, []);
  for (const garnish of value.product.garnishes) {
    if (garnish.kind === "PRODUCT") visit(garnish.product, [`garnish-${garnish.id}`]);
  }
  ingredientInputs.value = ingredients;
  quickInputs.value = Object.fromEntries(
    value.product.garnishes
      .filter((item) => item.kind === "QUICK")
      .map((item) => [item.id, { mode: "OMIT" }]),
  );
});

function updateProductSearch(value: SearchItem | string | null): void {
  if (typeof value !== "string") return;
  searchText.value = value;
  selectedId.value = "";
  result.value = null;
}
function clearProduct(): void {
  searchText.value = "";
  selectedProduct.value = null;
  selectedId.value = "";
  result.value = null;
}
function selectProduct(event: { value: SearchItem }): void {
  selectedProduct.value = event.value;
  selectedId.value = event.value.id;
}
function openCalculationMenu(event: MouseEvent, row: CalculatorTableRow): void {
  if (row.kind === "QUICK_GARNISH")
    activeCalculationMenu.value = { kind: "QUICK_GARNISH", id: row.id };
  else if (row.kind === "INGREDIENT")
    activeCalculationMenu.value = { kind: "INGREDIENT", id: row.key };
  quickGarnishMenu.value?.toggle(event);
}
function setQuickGarnishMode(mode: TemporaryQuickGarnish["mode"]): void {
  const garnishId = activeCalculationMenu.value?.id ?? "";
  const input = quickInputs.value[garnishId];
  if (!input) return;
  if (mode === "UNIT_PRICE") {
    const piece = priceUnits.value.find((unit) => unit.code === "pc" && unit.kind === "COUNT");
    Object.assign(input, {
      mode,
      amount: 1,
      unitId: piece?.id,
      priceUnitId: piece?.id,
      unitPrice: undefined,
    });
  } else if (mode === "ESTIMATE") {
    Object.assign(input, {
      mode,
      amount: undefined,
      unitPrice: undefined,
      priceUnitId: undefined,
    });
  } else {
    Object.assign(input, { mode, amount: undefined, unitPrice: undefined, priceUnitId: undefined });
  }
  result.value = null;
  quickGarnishMenu.value?.hide();
}
function setIngredientMode(mode: "ESTIMATE" | "OMIT"): void {
  const lineKey = activeCalculationMenu.value?.id ?? "";
  const input = ingredientInputs.value[lineKey];
  if (!input) return;
  Object.assign(input, {
    mode,
    priceUnitId: undefined,
    unitPrice: undefined,
    estimatedCost: undefined,
  });
  calculationAttempted.value = false;
  result.value = null;
  quickGarnishMenu.value?.hide();
}
function ingredientMode(row: CalculatorTableRow): TemporaryIngredient["mode"] {
  return row.kind === "INGREDIENT" ? ingredientInputs.value[row.key]?.mode : undefined;
}
function unsupportedIngredient(row: CalculatorTableRow): boolean {
  return (
    row.kind === "INGREDIENT" &&
    !priceUnits.value.some((unit) => automaticFactor(row.unit, unit) !== null)
  );
}
function ingredientEstimateInvalid(row: CalculatorTableRow): boolean {
  return row.kind === "INGREDIENT" && ingredientInputs.value[row.key]?.estimatedCost === undefined;
}
function showResultValue(row: CalculatorTableRow): boolean {
  if (row.kind === "INGREDIENT")
    return ingredientMode(row) !== "ESTIMATE" && ingredientMode(row) !== "OMIT";
  return row.kind !== "QUICK_GARNISH" || quickInputs.value[row.id]!.mode === "UNIT_PRICE";
}
function quickUnitPriceEnabled(row: CalculatorTableRow): row is QuickGarnishRow {
  return row.kind === "QUICK_GARNISH" && quickInputs.value[row.id]!.mode === "UNIT_PRICE";
}
function quickPriceUnits(id: string): CostCalculatorRecipeResponseDto["units"] {
  const input = quickInputs.value[id];
  return input?.unitId ? priceUnits.value.filter((unit) => unit.id === input.unitId) : [];
}
function updateQuickPrice(id: string, value: number | null): void {
  quickInputs.value[id]!.unitPrice = value ?? undefined;
  result.value = null;
}
function updateQuickPriceUnit(id: string, unitId: string): void {
  quickInputs.value[id]!.priceUnitId = unitId;
  result.value = null;
}
function resultLine(key: string) {
  return resultLines.value.get(key);
}
function compatiblePriceUnit(unit: { id: string; code: string; kind: string | null }) {
  return priceUnits.value.find((priceUnit) => automaticFactor(unit, priceUnit) !== null);
}
function ingredientUnitInvalid(row: CalculatorTableRow): boolean {
  if (row.kind !== "INGREDIENT") return false;
  const selectedUnitId = ingredientInputs.value[row.key]?.priceUnitId;
  const selectedUnit = priceUnits.value.find((unit) => unit.id === selectedUnitId);
  return Boolean(selectedUnit && automaticFactor(row.unit, selectedUnit) === null);
}
function quickGarnishUnitInvalid(row: CalculatorTableRow): boolean {
  if (row.kind !== "QUICK_GARNISH" || quickInputs.value[row.id]?.mode !== "UNIT_PRICE")
    return false;
  const input = quickInputs.value[row.id];
  const piece = priceUnits.value.find((unit) => unit.code === "pc" && unit.kind === "COUNT");
  return !piece || input?.unitId !== piece.id || input.priceUnitId !== piece.id;
}
function calculate(): void {
  mutationError.value = "";
  calculationAttempted.value = true;
  result.value = null;
  if (
    componentRows.value.some(
      (row) =>
        row.kind === "INGREDIENT" &&
        ((ingredientMode(row) === "UNIT_PRICE" && ingredientUnitInvalid(row)) ||
          (ingredientMode(row) === "ESTIMATE" && ingredientEstimateInvalid(row)) ||
          (unsupportedIngredient(row) && !ingredientMode(row))),
    ) ||
    quickGarnishRows.value.some((garnish) =>
      quickGarnishUnitInvalid({ ...garnish, key: `garnish-${garnish.id}`, kind: "QUICK_GARNISH" }),
    )
  )
    return;
  const ingredientInput = Object.entries(ingredientInputs.value).flatMap(([lineKey, value]) =>
    value.mode === "OMIT"
      ? [{ lineKey, mode: "OMIT" as const }]
      : value.mode === "ESTIMATE"
        ? value.estimatedCost === undefined
          ? []
          : [{ lineKey, mode: "ESTIMATE" as const, estimatedCost: value.estimatedCost }]
        : value.priceUnitId && value.unitPrice !== undefined
          ? [
              {
                lineKey,
                mode: "UNIT_PRICE" as const,
                priceUnitId: value.priceUnitId,
                unitPrice: value.unitPrice,
              },
            ]
          : [],
  );
  const quickGarnishInput = Object.entries(quickInputs.value).flatMap(([id, value]) => {
    if (value.mode === "OMIT") return [{ id, mode: "OMIT" as const }];
    if (value.mode === "ESTIMATE")
      return value.unitPrice === undefined
        ? []
        : [{ id, mode: "ESTIMATE" as const, estimatedPrice: value.unitPrice }];
    if (value.unitPrice === undefined || !value.priceUnitId) return [];
    if (value.amount === undefined || !value.unitId) return [];
    return [
      {
        id,
        mode: "UNIT_PRICE" as const,
        amount: value.amount,
        unitId: value.unitId,
        priceUnitId: value.priceUnitId,
        unitPrice: value.unitPrice,
      },
    ];
  });
  calculateMutation.mutate({
    ingredientInputs: ingredientInput,
    quickGarnishes: quickGarnishInput,
  });
}
const compactTagPt = {
  root: { style: { fontSize: "0.75rem", padding: "0.125rem 0.375rem" } },
  label: { style: { fontWeight: "400" } },
};
function formatAmount(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(value);
}
function money(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
function automaticFactor(
  from: { id: string; code: string; kind: string | null },
  to: { id: string; code: string; kind: string | null },
): number | null {
  if (from.id === to.id) return 1;
  if (!from.kind || from.kind !== to.kind) return null;
  const factors: Record<string, number> = { ml: 1, l: 1000, g: 1, kg: 1000, pc: 1 };
  return factors[from.code] && factors[to.code] ? factors[from.code]! / factors[to.code]! : null;
}
</script>

<style scoped>
.cost-calculator-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px 90px;
  align-items: center;
  gap: 0.5rem;
}

.cost-calculator-grid-with-sum {
  grid-template-columns: minmax(0, 1fr) 110px 90px 80px;
}

.cost-calculator-header {
  padding-block: 0.25rem;
  white-space: nowrap;
}

.cost-calculator-header > span {
  display: block;
  width: 100%;
  justify-self: start;
  text-align: left;
}

.cost-calculator-row {
  padding-block: 0.25rem;
}

:deep(.p-inputnumber-input) {
  min-width: 0;
  padding-inline: 0.375rem;
}

:deep(.p-select-label) {
  overflow: hidden;
  padding-inline: 0.375rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .cost-calculator-grid {
    grid-template-columns: minmax(0, 1fr) 110px 90px;
    gap: 0.375rem;
  }

  .cost-calculator-grid-with-sum {
    grid-template-columns: minmax(0, 1fr) 110px 90px 80px;
  }
}
</style>
