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
          @click="remove(row.key)"
        />
      </div>
      <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_8rem]">
        <div class="flex flex-col gap-1">
          <IngredientSelector
            :model-value="row.product"
            :company-id="companyId"
            :venue-id="venueId"
            :service-session-id="serviceSessionId"
            placeholder="Найти ингредиент или заготовку"
            @update:model-value="selectProduct(row.key, $event)"
          />
          <small v-if="errors?.[index]?.productId" class="text-xs text-red-500">{{
            errors[index]?.productId
          }}</small>
        </div>
        <div class="flex flex-col gap-1">
          <FloatLabel variant="on">
            <InputText
              :id="`garnish-component-${row.key}-amount`"
              :model-value="row.amount"
              inputmode="decimal"
              size="small"
              fluid
              @update:model-value="updateRow(row.key, { amount: String($event ?? '') })"
            />
            <label :for="`garnish-component-${row.key}-amount`" class="text-xs">Количество</label>
          </FloatLabel>
          <small v-if="errors?.[index]?.amount" class="text-xs text-red-500">{{
            errors[index]?.amount
          }}</small>
        </div>
        <div class="flex flex-col gap-1">
          <FloatLabel variant="on">
            <Select
              :input-id="`garnish-component-${row.key}-unit`"
              :model-value="row.unitId"
              :options="units"
              option-label="label"
              option-value="id"
              size="small"
              class="w-full"
              @update:model-value="updateRow(row.key, { unitId: $event })"
            />
            <label :for="`garnish-component-${row.key}-unit`" class="text-xs">Единица</label>
          </FloatLabel>
          <small v-if="errors?.[index]?.unitId" class="text-xs text-red-500">{{
            errors[index]?.unitId
          }}</small>
        </div>
      </div>
      <Button
        v-if="canManage && activeLocalIngredientRow !== row.key"
        label="Нет ингредиента? Создать локальный"
        severity="secondary"
        variant="text"
        size="small"
        class="mt-2 px-0"
        @click="activeLocalIngredientRow = row.key"
      />
      <div
        v-if="canManage && activeLocalIngredientRow === row.key"
        class="mt-3"
        @input.capture="emit('dirty')"
        @change.capture="emit('dirty')"
        @submit.stop
      >
        <LocalIngredientCreateForm
          :categories="ingredientCategories"
          :create="createLocalIngredient"
          @cancel="activeLocalIngredientRow = null"
          @created="assignCreatedIngredient(row.key, $event)"
        />
      </div>
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

export type GarnishComponentRow = {
  key: string;
  productId: string;
  product: ProductSearchItem | null;
  amount: string;
  unitId: string;
};
export type GarnishComponentErrors = Partial<Record<"productId" | "amount" | "unitId", string>>;
const props = defineProps<{
  modelValue: GarnishComponentRow[];
  companyId: string;
  venueId: string;
  serviceSessionId?: string;
  units: Array<{ id: string; label: string }>;
  ingredientCategories: Array<{ code: string; name: string }>;
  errors?: GarnishComponentErrors[];
  canManage: boolean;
  createLocalIngredient: (input: {
    name: string;
    categoryCode: string;
    brand?: string;
  }) => Promise<ProductCreated>;
}>();
const emit = defineEmits<{ "update:modelValue": [rows: GarnishComponentRow[]]; dirty: [] }>();
const activeLocalIngredientRow = ref<string | null>(null);
function updateRow(key: string, patch: Partial<GarnishComponentRow>): void {
  emit(
    "update:modelValue",
    props.modelValue.map((row) => (row.key === key ? { ...row, ...patch } : row)),
  );
}
function selectProduct(key: string, product: ProductSearchItem | null): void {
  updateRow(key, {
    product,
    productId: product && typeof product === "object" ? product.id : "",
  });
}
function add(): void {
  emit("update:modelValue", [
    ...props.modelValue,
    { key: crypto.randomUUID(), productId: "", product: null, amount: "", unitId: "" },
  ]);
}
function remove(key: string): void {
  if (activeLocalIngredientRow.value === key) activeLocalIngredientRow.value = null;
  emit(
    "update:modelValue",
    props.modelValue.filter((row) => row.key !== key),
  );
}
function assignCreatedIngredient(key: string, product: ProductCreated): void {
  const row = props.modelValue.find((item) => item.key === key);
  if (!row) return;
  updateRow(key, {
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
  const control = row.amount.trim() ? "unit" : "amount";
  void nextTick(() => document.getElementById(`garnish-component-${row.key}-${control}`)?.focus());
}
</script>
