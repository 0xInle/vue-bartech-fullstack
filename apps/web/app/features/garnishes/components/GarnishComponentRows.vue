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
            :invalid="Boolean(errors?.[index]?.productId)"
            :input-id="`garnish-component-${row.key}-ingredient`"
            placeholder="Найти ингредиент или заготовку"
            @update:model-value="selectProduct(row.key, $event)"
            @hide="handleIngredientHide(row.key)"
          >
            <template #footer="{ query, loading, hasResults, hasError, hasLoaded }">
              <div
                v-if="query.trim().length >= 2"
                class="box-border flex w-full min-w-0 max-w-full flex-col items-center gap-2 p-2"
                @mousedown.stop
              >
                <span v-if="loading" class="text-xs text-color-secondary">Ищем ингредиент…</span>
                <template v-else-if="hasLoaded && !hasError">
                  <span v-if="!hasResults" class="text-xs text-color-secondary"
                    >Ингредиент не найден</span
                  >
                  <template v-if="canManage">
                    <Divider class="!my-0" />
                    <span v-if="hasResults" class="text-xs text-color-secondary"
                      >Не нашли нужное?</span
                    >
                    <div
                      v-if="activeLocalIngredientRow === row.key"
                      class="flex w-full min-w-0 flex-col gap-2"
                      @input.capture="markLocalIngredientDraft(row.key)"
                      @change.capture="markLocalIngredientDraft(row.key)"
                      @submit.stop
                    >
                      <LocalIngredientCreateForm
                        compact
                        :initial-name="localIngredientName"
                        :categories="ingredientCategories"
                        :create="createLocalIngredient"
                        @cancel="closeLocalIngredientForm"
                        @created="assignCreatedIngredient(row.key, $event)"
                      />
                    </div>
                    <Button
                      v-else
                      type="button"
                      label="Создать ингредиент"
                      icon="pi pi-plus"
                      severity="secondary"
                      variant="text"
                      size="small"
                      @mousedown.prevent
                      @click.stop="startLocalIngredientCreate(row.key, query)"
                    />
                  </template>
                </template>
              </div>
            </template>
          </IngredientSelector>
        </div>
        <FloatLabel variant="on">
          <InputText
            :id="`garnish-component-${row.key}-amount`"
            :model-value="row.amount"
            inputmode="decimal"
            size="small"
            fluid
            :invalid="Boolean(errors?.[index]?.amount)"
            @update:model-value="updateRow(row.key, { amount: String($event ?? '') })"
          />
          <label :for="`garnish-component-${row.key}-amount`" class="text-xs">Кол-во</label>
        </FloatLabel>
        <FloatLabel variant="on">
          <Select
            :ref="(instance) => setUnitSelectRef(row.key, instance)"
            :input-id="`garnish-component-${row.key}-unit`"
            :model-value="row.unitId"
            append-to="self"
            :pt="{ overlay: { class: 'w-max min-w-full' } }"
            :options="availableUnits()"
            option-label="label"
            option-value="id"
            size="small"
            class="w-24"
            :invalid="Boolean(errors?.[index]?.unitId)"
            @show="handleUnitSelectShow(row.key)"
            @update:model-value="updateRow(row.key, { unitId: $event })"
          >
            <template #value="slotProps">
              {{ unitLabel(row.unitId) || slotProps.placeholder }}
            </template>
          </Select>
          <label :for="`garnish-component-${row.key}-unit`" class="text-xs">Ед. изм.</label>
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
          @click="remove(row.key)"
        />
      </div>
    </div>
    <Button label="Добавить ингредиент" size="small" class="w-full" @click="add" />
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

export type GarnishComponentRow = {
  key: string;
  productId: string;
  product: ProductSearchItem | null;
  amount: string;
  unitId: string;
};
export type GarnishComponentField = "productId" | "amount" | "unitId";
export type GarnishComponentErrors = Partial<Record<GarnishComponentField, boolean>>;
const props = defineProps<{
  modelValue: GarnishComponentRow[];
  companyId: string;
  venueId: string;
  serviceSessionId?: string;
  units: Array<{ id: string; code: string; label: string }>;
  ingredientCategories: Array<{ code: string; name: string }>;
  errors?: GarnishComponentErrors[];
  canManage: boolean;
  createLocalIngredient: (input: {
    name: string;
    categoryCode: string;
    brand?: string;
  }) => Promise<ProductCreated>;
}>();
const emit = defineEmits<{
  "update:modelValue": [rows: GarnishComponentRow[]];
  dirty: [];
  "local-ingredient-draft": [active: boolean];
}>();
const activeLocalIngredientRow = ref<string | null>(null);
const localIngredientName = ref("");
const localIngredientDraftRowKey = ref<string | null>(null);
const ingredientSelector = ref<InstanceType<typeof IngredientSelector>[]>([]);
const unitSelectRefs = new Map<string, PrimeVueOverlayRef>();
const defaultUnitId = computed(
  () => props.units.find((unit) => unit.label.trim().toLocaleLowerCase("ru") === "мл")?.id ?? "",
);
function setUnitSelectRef(key: string, instance: PrimeVueOverlayRef | null): void {
  if (instance) unitSelectRefs.set(key, instance);
  else unitSelectRefs.delete(key);
}
function handleUnitSelectShow(key: string): void {
  const select = unitSelectRefs.get(key);
  keepPrimeVueOverlayOpenOnScroll(select);
  keepPrimeVueOverlayWithinDrawer(select);
}
function availableUnits() {
  return props.units.filter((unit) => unit.code !== "bar-spoon");
}
function unitLabel(unitId: string): string {
  return props.units.find((unit) => unit.id === unitId)?.label ?? "";
}
function updateRow(key: string, patch: Partial<GarnishComponentRow>): void {
  emit(
    "update:modelValue",
    props.modelValue.map((row) => (row.key === key ? { ...row, ...patch } : row)),
  );
}
function selectProduct(key: string, product: ProductSearchItem | null): void {
  if (activeLocalIngredientRow.value === key) closeLocalIngredientForm();
  updateRow(key, {
    product,
    productId: product && typeof product === "object" ? product.id : "",
  });
}
function add(): void {
  emit("update:modelValue", [
    ...props.modelValue,
    {
      key: crypto.randomUUID(),
      productId: "",
      product: null,
      amount: "",
      unitId: defaultUnitId.value,
    },
  ]);
}
function startLocalIngredientCreate(key: string, query: string): void {
  localIngredientName.value = query;
  activeLocalIngredientRow.value = key;
}
function handleIngredientHide(key: string): void {
  if (activeLocalIngredientRow.value === key && localIngredientDraftRowKey.value !== key)
    closeLocalIngredientForm();
}
function markLocalIngredientDraft(key: string): void {
  localIngredientDraftRowKey.value = key;
  emit("dirty");
  emit("local-ingredient-draft", true);
}
function remove(key: string): void {
  if (activeLocalIngredientRow.value === key) closeLocalIngredientForm();
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
  localIngredientName.value = "";
  localIngredientDraftRowKey.value = null;
  emit("local-ingredient-draft", false);
  const control = row.amount.trim() ? "unit" : "amount";
  const index = props.modelValue.findIndex((item) => item.key === key);
  void nextTick(() => {
    if (index >= 0) ingredientSelector.value[index]?.hideSuggestions();
    document.getElementById(`garnish-component-${row.key}-${control}`)?.focus();
  });
}
function closeLocalIngredientForm(): void {
  activeLocalIngredientRow.value = null;
  localIngredientName.value = "";
  localIngredientDraftRowKey.value = null;
  emit("local-ingredient-draft", false);
}
</script>
