<template>
  <div class="flex flex-col gap-3">
    <div
      v-for="(row, index) in modelValue"
      :key="row.key"
      class="rounded-lg border border-surface p-3"
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <p class="text-xs font-medium text-color-secondary">Компонент {{ index + 1 }}</p>
        <Button
          v-if="modelValue.length > 1"
          icon="pi pi-times"
          severity="secondary"
          variant="text"
          rounded
          size="small"
          aria-label="Удалить компонент"
          @click="remove(index)"
        />
      </div>
      <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_8rem]">
        <IngredientSelector
          :model-value="row.product"
          :company-id="companyId"
          :venue-id="venueId"
          :service-session-id="serviceSessionId"
          placeholder="Найти ингредиент или заготовку"
          @update:model-value="selectProduct(index, $event)"
        />
        <InputText
          :id="`cocktail-component-${row.key}-amount`"
          :model-value="row.amount"
          inputmode="decimal"
          size="small"
          placeholder="Количество"
          @update:model-value="updateAmount(index, $event ?? '')"
        />
        <Select
          :id="`cocktail-component-${row.key}-unit`"
          :model-value="row.unitId"
          :options="units"
          option-label="label"
          option-value="id"
          placeholder="Единица"
          size="small"
          @update:model-value="updateUnit(index, $event)"
        />
      </div>
      <p v-if="errors?.[index]" class="mt-2 text-xs text-red-500">{{ errors[index] }}</p>
      <Button
        v-if="canManage && activeLocalIngredientRow !== index"
        label="Нет ингредиента? Создать локальный"
        severity="secondary"
        variant="text"
        size="small"
        class="mt-2 px-0"
        @click="activeLocalIngredientRow = index"
      />
      <LocalIngredientCreateForm
        v-if="canManage && activeLocalIngredientRow === index"
        class="mt-3"
        :categories="ingredientCategories"
        :create="createLocalIngredient"
        @cancel="activeLocalIngredientRow = null"
        @created="assignCreatedIngredient(index, $event)"
      />
    </div>
    <Button
      label="Добавить компонент"
      icon="pi pi-plus"
      severity="secondary"
      variant="outlined"
      size="small"
      class="self-start"
      @click="add"
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import IngredientSelector from "~/features/products/components/IngredientSelector.vue";
import LocalIngredientCreateForm from "~/features/products/components/LocalIngredientCreateForm.vue";
import type { ProductCreated, ProductSearchItem } from "~/features/products/types";

export type CocktailComponentRow = {
  key: string;
  productId: string;
  product: ProductSearchItem | null;
  amount: string;
  unitId: string;
};

const props = defineProps<{
  modelValue: CocktailComponentRow[];
  companyId: string;
  venueId: string;
  serviceSessionId?: string;
  units: Array<{ id: string; label: string }>;
  ingredientCategories: Array<{ code: string; name: string }>;
  errors?: string[];
  canManage: boolean;
  createLocalIngredient: (input: {
    name: string;
    categoryCode: string;
    brand?: string;
  }) => Promise<ProductCreated>;
}>();
const emit = defineEmits<{ "update:modelValue": [rows: CocktailComponentRow[]] }>();

const activeLocalIngredientRow = ref<number | null>(null);

function emptyRow(): CocktailComponentRow {
  return { key: crypto.randomUUID(), productId: "", product: null, amount: "", unitId: "" };
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

function add(): void {
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
