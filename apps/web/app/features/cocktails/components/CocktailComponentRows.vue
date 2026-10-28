<template>
  <div class="flex flex-col gap-3">
    <div v-for="(row, index) in modelValue" :key="row.key" class="flex flex-col gap-2">
      <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_max-content_auto]">
        <div class="min-w-0">
          <IngredientSelector
            ref="ingredientSelector"
            :model-value="row.product"
            :company-id="companyId"
            :venue-id="venueId"
            :service-session-id="serviceSessionId"
            keep-overlay-open-on-scroll
            float-label
            label="Ингредиент"
            :invalid="errors?.[index]?.ingredient ?? false"
            :input-id="`cocktail-component-${row.key}-ingredient`"
            placeholder="Найти ингредиент или заготовку"
            @update:model-value="selectProduct(index, $event)"
            @hide="activeLocalIngredientRow = null"
          >
            <template
              #footer="{ query, loading, hasResults, hasError, hasLoaded, hasExactIngredient }"
            >
              <div
                v-if="query.trim().length >= 2"
                class="box-border flex w-full min-w-0 max-w-full flex-col items-center gap-2 p-2"
              >
                <span v-if="loading" class="text-xs text-color-secondary">Ищем ингредиент…</span>
                <template v-else-if="hasLoaded && !hasError && !hasExactIngredient">
                  <span v-if="!hasResults" class="text-xs text-color-secondary"
                    >Ингредиент не найден</span
                  >
                  <template v-if="canManage">
                    <Divider class="!my-0" />
                    <span v-if="hasResults" class="text-xs text-color-secondary"
                      >Не нашли нужное?</span
                    >
                    <LocalIngredientCreateForm
                      v-if="activeLocalIngredientRow === index"
                      compact
                      :initial-name="localIngredientName"
                      :categories="ingredientCategories"
                      :create="createLocalIngredient"
                      @cancel="activeLocalIngredientRow = null"
                      @created="assignCreatedIngredient(index, $event)"
                    />
                    <Button
                      v-else
                      type="button"
                      label="Создать ингредиент"
                      icon="pi pi-plus"
                      severity="secondary"
                      variant="text"
                      size="small"
                      @mousedown.prevent
                      @click.stop="startLocalIngredientCreate(index, query)"
                    />
                  </template>
                </template>
              </div>
            </template>
          </IngredientSelector>
        </div>
        <FloatLabel variant="on">
          <InputText
            :id="`cocktail-component-${row.key}-amount`"
            :model-value="row.amount"
            inputmode="decimal"
            size="small"
            fluid
            :invalid="errors?.[index]?.amount ?? false"
            @update:model-value="updateAmount(index, $event ?? '')"
          />
          <label :for="`cocktail-component-${row.key}-amount`" class="text-xs">Объём</label>
        </FloatLabel>
        <FloatLabel variant="on">
          <Select
            :ref="(instance) => setUnitSelectRef(index, instance)"
            :input-id="`cocktail-component-${row.key}-unit`"
            :model-value="row.unitId || defaultUnitId"
            append-to="self"
            :pt="{ overlay: { class: 'w-max min-w-full' } }"
            :options="availableUnits"
            option-label="label"
            option-value="id"
            size="small"
            class="w-24"
            :invalid="errors?.[index]?.unit ?? false"
            @show="handleUnitSelectShow(index)"
            @update:model-value="updateUnit(index, $event)"
          >
            <template #value="slotProps">
              {{ unitLabel(row.unitId || defaultUnitId) || slotProps.placeholder }}
            </template>
          </Select>
          <label :for="`cocktail-component-${row.key}-unit`" class="text-xs">Единица</label>
        </FloatLabel>
        <Button
          v-if="modelValue.length > 1"
          icon="pi pi-times"
          severity="secondary"
          variant="text"
          rounded
          size="small"
          class="justify-self-end sm:self-center"
          aria-label="Удалить компонент"
          @click="remove(index)"
        />
      </div>
    </div>
    <Button
      label="Добавить ингредиент"
      size="small"
      class="w-full"
      :disabled="modelValue.length >= 20"
      @click="add"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import IngredientSelector from "~/features/products/components/IngredientSelector.vue";
import LocalIngredientCreateForm from "~/features/products/components/LocalIngredientCreateForm.vue";
import type { ProductCreated, ProductSearchItem } from "~/features/products/types";
import {
  keepPrimeVueOverlayOpenOnScroll,
  keepPrimeVueOverlayWithinDrawer,
  type PrimeVueOverlayRef,
} from "~/utils/primevue-overlay";

export type CocktailComponentRow = {
  key: string;
  productId: string;
  product: ProductSearchItem | null;
  amount: string;
  unitId: string;
};

export type CocktailComponentError = {
  ingredient: boolean;
  amount: boolean;
  unit: boolean;
};

const props = defineProps<{
  modelValue: CocktailComponentRow[];
  companyId: string;
  venueId: string;
  serviceSessionId?: string;
  units: Array<{ id: string; code: string; label: string }>;
  ingredientCategories: Array<{ code: string; name: string }>;
  errors?: CocktailComponentError[];
  canManage: boolean;
  createLocalIngredient: (input: {
    name: string;
    categoryCode: string;
    brand?: string;
  }) => Promise<ProductCreated>;
}>();
const emit = defineEmits<{ "update:modelValue": [rows: CocktailComponentRow[]] }>();

const activeLocalIngredientRow = ref<number | null>(null);
const localIngredientName = ref("");
const ingredientSelector = ref<InstanceType<typeof IngredientSelector>[]>([]);
const unitSelectRefs = new Map<number, PrimeVueOverlayRef>();
const defaultUnitId = computed(
  () => props.units.find((unit) => unit.label.trim().toLocaleLowerCase("ru") === "мл")?.id ?? "",
);
const availableUnits = computed(() => props.units.filter((unit) => unit.code !== "spray"));

function setUnitSelectRef(index: number, instance: PrimeVueOverlayRef | null): void {
  if (instance) unitSelectRefs.set(index, instance);
  else unitSelectRefs.delete(index);
}

function handleUnitSelectShow(index: number): void {
  const select = unitSelectRefs.get(index);
  keepPrimeVueOverlayOpenOnScroll(select);
  keepPrimeVueOverlayWithinDrawer(select);
}

function emptyRow(): CocktailComponentRow {
  return {
    key: crypto.randomUUID(),
    productId: "",
    product: null,
    amount: "",
    unitId: defaultUnitId.value,
  };
}

function updateRow(index: number, patch: Partial<CocktailComponentRow>): void {
  emit(
    "update:modelValue",
    props.modelValue.map((row, position) => (position === index ? { ...row, ...patch } : row)),
  );
}

function selectProduct(index: number, product: ProductSearchItem | null): void {
  updateRow(index, { product, productId: product?.id ?? "" });
}

function updateAmount(index: number, amount: string | number): void {
  updateRow(index, { amount: String(amount ?? "") });
}

function updateUnit(index: number, unitId: string): void {
  updateRow(index, { unitId });
}

function startLocalIngredientCreate(index: number, query: string): void {
  localIngredientName.value = query;
  activeLocalIngredientRow.value = index;
}

function unitLabel(unitId: string): string {
  return props.units.find((unit) => unit.id === unitId)?.label ?? "";
}

function add(): void {
  if (props.modelValue.length >= 20) {
    return;
  }

  emit("update:modelValue", [...props.modelValue, emptyRow()]);
}

function remove(index: number): void {
  emit(
    "update:modelValue",
    props.modelValue.filter((_, position) => position !== index),
  );
}

function assignCreatedIngredient(index: number, product: ProductCreated): void {
  const row = props.modelValue[index];
  if (!row) {
    return;
  }

  updateRow(index, {
    productId: product.id,
    product: {
      id: product.id,
      name: product.name,
      type: "INGREDIENT",
      venueId: product.venueId,
      scope: "VENUE",
      matchReason: "EXACT_NAME",
      brand: null,
      categoryCode: null,
      strength: null,
    },
  });
  activeLocalIngredientRow.value = null;
  void nextTick(() => ingredientSelector.value[index]?.hideSuggestions());
  focusNextRequiredControl(row);
}

function focusNextRequiredControl(row: CocktailComponentRow): void {
  const control = !row.amount.trim() ? "amount" : !row.unitId ? "unit" : null;
  if (!control) {
    return;
  }

  void nextTick(() => {
    document.getElementById(`cocktail-component-${row.key}-${control}`)?.focus();
  });
}
</script>
