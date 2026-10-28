<template>
  <Drawer
    :visible="visible"
    position="right"
    block-scroll
    class="cocktail-drawer drawer-size-md"
    :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
    @update:visible="requestVisibilityChange"
  >
    <template #header="{ class: titleClass }">
      <span :class="[titleClass, 'leading-none']">
        {{ mode === "edit" ? "Редактировать коктейль" : "Создать коктейль" }}
      </span>
    </template>
    <LoadingIndicator v-if="referencesQuery.isLoading.value" class="py-8" />
    <form v-else class="flex flex-col gap-5 pt-3" @submit.prevent="submit">
      <Message v-if="saveError" severity="error" :closable="false" :pt="compactMessagePt">
        {{ saveError }}
      </Message>
      <Message
        v-if="referencesQuery.isError.value"
        severity="error"
        :closable="false"
        :pt="compactMessagePt"
      >
        Не удалось загрузить справочники. Обновите страницу и попробуйте ещё раз.
      </Message>

      <div class="flex flex-col gap-2">
        <FloatLabel variant="on">
          <InputText
            id="cocktail-name"
            v-model="name"
            size="small"
            fluid
            :invalid="Boolean(errors.name)"
            @input="markDirty"
          />
          <label for="cocktail-name" class="text-xs">Название</label>
        </FloatLabel>
      </div>

      <div class="flex flex-col gap-2">
        <CocktailComponentRows
          v-model="components"
          :company-id="companyId"
          :venue-id="venueId"
          :service-session-id="serviceSessionId"
          :units="cocktailUnits"
          :ingredient-categories="references.ingredientCategories"
          :errors="componentErrors"
          :can-manage="canManage"
          :create-local-ingredient="createLocalIngredient"
          @update:model-value="handleComponentsUpdate"
        />
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <div class="flex flex-col gap-2">
          <CocktailReferenceSelect
            v-model="glassId"
            input-id="cocktail-glass"
            label="Посуда"
            :options="glasses"
            type="GLASS"
            :can-create="canManage"
            :create="createLocalReferenceValue"
            :invalid="Boolean(errors.glassId)"
            @update:model-value="markDirty"
          />
        </div>
        <div class="flex flex-col gap-2">
          <CocktailReferenceSelect
            v-model="iceId"
            input-id="cocktail-ice"
            label="Лёд"
            :options="iceOptions"
            type="ICE"
            :can-create="false"
            :create="createLocalReferenceValue"
            :invalid="Boolean(errors.iceId)"
            @update:model-value="markDirty"
          />
        </div>
        <div class="flex flex-col gap-2">
          <CocktailReferenceSelect
            v-model="preparationMethodId"
            input-id="cocktail-method"
            label="Метод"
            :options="preparationMethods"
            type="PREPARATION_METHOD"
            :can-create="false"
            :create="createLocalReferenceValue"
            :invalid="Boolean(errors.preparationMethodId)"
            @update:model-value="markDirty"
          />
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <CocktailGarnishSelect
          v-model="garnishIds"
          input-id="cocktail-garnishes"
          :options="garnishesQuery.data.value ?? []"
          :can-create="canManage"
          :loading="garnishesQuery.isFetching.value"
          :create="createLocalReferenceValue"
          :invalid="Boolean(errors.garnishIds)"
          @update:model-value="markDirty"
        />
      </div>

      <div class="flex flex-col gap-2">
        <FloatLabel variant="on">
          <Textarea
            id="cocktail-technology"
            v-model="technology"
            rows="5"
            size="small"
            fluid
            class="resize-none overflow-y-auto"
            :invalid="Boolean(errors.technology)"
            @input="markDirty"
          />
          <label for="cocktail-technology" class="text-xs">Технология приготовления</label>
        </FloatLabel>
      </div>

      <div class="flex flex-col gap-2">
        <CocktailCategorySelect
          v-model="categoryIds"
          input-id="cocktail-categories"
          :options="cocktailCategories"
          :can-create="canManage"
          :invalid="Boolean(errors.categoryIds)"
          :create="createLocalReferenceValue"
          @update:model-value="markDirty"
        />
      </div>

      <div class="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <div class="flex flex-col gap-2">
          <FloatLabel variant="on">
            <InputText
              id="cocktail-output"
              v-model="outputAmount"
              inputmode="decimal"
              size="small"
              fluid
              :invalid="Boolean(errors.outputAmount)"
              @input="markDirty"
            />
            <label for="cocktail-output" class="text-xs">Фактический выход</label>
          </FloatLabel>
        </div>
        <div class="flex flex-col gap-2">
          <FloatLabel variant="on">
            <Select
              ref="outputUnitSelect"
              v-model="outputUnitId"
              input-id="cocktail-output-unit"
              append-to="self"
              :pt="{ overlay: { class: 'w-max min-w-full' } }"
              :options="cocktailUnits"
              option-label="label"
              option-value="id"
              size="small"
              fluid
              :invalid="Boolean(errors.outputUnitId)"
              @show="handleOutputUnitSelectShow"
              @update:model-value="markDirty"
            />
            <label for="cocktail-output-unit" class="text-xs">Единица</label>
          </FloatLabel>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <FloatLabel variant="on">
          <Textarea
            id="cocktail-comment"
            v-model="comment"
            rows="3"
            size="small"
            fluid
            class="resize-none overflow-y-auto"
            :invalid="Boolean(errors.comment)"
            @input="markDirty"
          />
          <label for="cocktail-comment" class="text-xs">Комментарий</label>
        </FloatLabel>
      </div>

      <div class="flex justify-end gap-2">
        <Button
          label="Отмена"
          severity="secondary"
          variant="text"
          size="small"
          @click="requestVisibilityChange(false)"
        />
        <Button
          :label="mode === 'edit' ? 'Сохранить изменения' : 'Создать коктейль'"
          type="submit"
          size="small"
          :loading="saving"
          :disabled="referencesQuery.isLoading.value || referencesQuery.isError.value"
        />
      </div>
    </form>
  </Drawer>
  <Dialog
    v-model:visible="closeConfirmationVisible"
    modal
    header="Закрыть форму?"
    class="w-full max-w-md"
    :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
  >
    <p class="text-sm text-color-secondary">Несохранённые изменения будут потеряны.</p>
    <template #footer>
      <Button
        label="Продолжить"
        severity="secondary"
        variant="text"
        size="small"
        @click="closeConfirmationVisible = false"
      />
      <Button label="Закрыть" severity="danger" size="small" @click="discardAndClose" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useForm } from "vee-validate";
import { z } from "zod";
import type {
  ProductsControllerCreateCocktailMutationBody as CreateCocktailDto,
  ProductsControllerUpdateCocktailMutationBody as UpdateCocktailDto,
} from "@bartech/api-client";
import CocktailComponentRows, {
  type CocktailComponentError,
  type CocktailComponentRow,
} from "./CocktailComponentRows.vue";
import CocktailReferenceSelect from "./CocktailReferenceSelect.vue";
import CocktailGarnishSelect from "./CocktailGarnishSelect.vue";
import CocktailCategorySelect from "./CocktailCategorySelect.vue";
import { useCocktails, type CocktailCardResponseDto } from "../composables/useCocktails";
import type { ProductSearchItem } from "~/features/products/types";
import { compactMessagePt } from "~/utils/primevue-message";
import {
  keepPrimeVueOverlayOpenOnScroll,
  keepPrimeVueOverlayWithinDrawer,
  type PrimeVueOverlayRef,
} from "~/utils/primevue-overlay";

type CocktailFormValues = {
  name: string;
  glassId: string;
  iceId: string;
  preparationMethodId: string;
  technology: string;
  comment: string;
  outputAmount: string;
  outputUnitId: string;
  garnishIds: string[];
  categoryIds: string[];
};

const outputUnitSelect = ref<PrimeVueOverlayRef | null>(null);

const props = defineProps<{
  companyId: string;
  venueId: string;
  serviceSessionId?: string;
  visible: boolean;
  canManage: boolean;
  mode: "create" | "edit";
  cocktail?: CocktailCardResponseDto | null;
}>();
const emit = defineEmits<{
  "update:visible": [visible: boolean];
  created: [cocktailId: string];
  updated: [cocktailId: string];
}>();

const {
  createCocktail,
  createLocalIngredient,
  createLocalReferenceValue,
  garnishesQuery,
  referencesQuery,
  updateCocktail,
} = useCocktails(
  () => props.companyId,
  () => props.venueId,
  { serviceSessionId: props.serviceSessionId },
);
const { defineField, errors, handleSubmit, resetForm, setFieldError, values } =
  useForm<CocktailFormValues>({ initialValues: initialValues() });
const [name] = defineField("name");
const [glassId] = defineField("glassId");
const [iceId] = defineField("iceId");
const [preparationMethodId] = defineField("preparationMethodId");
const [technology] = defineField("technology");
const [comment] = defineField("comment");
const [outputAmount] = defineField("outputAmount");
const [outputUnitId] = defineField("outputUnitId");
const [garnishIds] = defineField("garnishIds");
const [categoryIds] = defineField("categoryIds");
const components = ref<CocktailComponentRow[]>([emptyComponent()]);
const dirty = ref(false);
const saving = ref(false);
const closeConfirmationVisible = ref(false);
const saveError = ref("");
const validationAttempted = ref(false);
const componentErrors = ref<CocktailComponentError[]>([]);
const validatedComponentKeys = ref(new Set<string>());

const references = computed(
  () =>
    referencesQuery.data.value ?? {
      units: [],
      ingredientCategories: [],
      preparationCategories: [],
      referenceValues: [],
    },
);
const glasses = computed(() =>
  references.value.referenceValues
    .filter((item) => item.type === "GLASS")
    .sort((first, second) => first.label.localeCompare(second.label, "ru")),
);
const iceOptions = computed(() =>
  references.value.referenceValues
    .filter((item) => item.type === "ICE")
    .sort((first, second) => first.label.localeCompare(second.label, "ru")),
);
const preparationMethods = computed(() =>
  references.value.referenceValues
    .filter((item) => item.type === "PREPARATION_METHOD")
    .sort((first, second) => first.label.localeCompare(second.label, "ru")),
);
const cocktailCategories = computed(() =>
  references.value.referenceValues
    .filter((item) => item.type === "COCKTAIL_CATEGORY")
    .sort((first, second) => first.label.localeCompare(second.label, "ru")),
);
const cocktailUnits = computed(() =>
  references.value.units.filter((unit) => unit.code !== "bar-spoon"),
);
const defaultComponentUnitId = computed(
  () =>
    references.value.units.find((unit) => unit.label.trim().toLocaleLowerCase("ru") === "мл")?.id ??
    "",
);

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      reset();
      return;
    }
    saveError.value = "";
  },
  { immediate: true },
);

watch(
  () => [values, components.value],
  () => {
    if (validationAttempted.value) refreshValidationState();
  },
  { deep: true, flush: "post" },
);

function initialValues(): CocktailFormValues {
  return {
    name: "",
    glassId: "",
    iceId: "",
    preparationMethodId: "",
    technology: "",
    comment: "",
    outputAmount: "",
    outputUnitId: "",
    garnishIds: [],
    categoryIds: [],
  };
}

function emptyComponent(): CocktailComponentRow {
  return { key: crypto.randomUUID(), productId: "", product: null, amount: "", unitId: "" };
}

function markDirty(): void {
  dirty.value = true;
}

function handleOutputUnitSelectShow(): void {
  keepPrimeVueOverlayOpenOnScroll(outputUnitSelect.value);
  keepPrimeVueOverlayWithinDrawer(outputUnitSelect.value);
}

function handleComponentsUpdate(rows: CocktailComponentRow[]): void {
  components.value = rows;
  markDirty();
}

function reset(): void {
  const cocktail = props.mode === "edit" ? props.cocktail : null;
  resetForm({ values: cocktail ? valuesFromCocktail(cocktail) : initialValues() });
  components.value = cocktail ? componentRowsFromCocktail(cocktail) : [emptyComponent()];
  dirty.value = false;
  saveError.value = "";
  validationAttempted.value = false;
  componentErrors.value = [];
  validatedComponentKeys.value.clear();
}

function valuesFromCocktail(cocktail: CocktailCardResponseDto): CocktailFormValues {
  return {
    name: cocktail.name,
    glassId: stringValue(cocktail.glassId),
    iceId: stringValue(cocktail.iceId),
    preparationMethodId: stringValue(cocktail.preparationMethodId),
    technology: cocktail.technology,
    comment: cocktail.comment ?? "",
    outputAmount: cocktail.output ? String(cocktail.output.amount) : "",
    outputUnitId: cocktail.output?.unitId ?? "",
    garnishIds: cocktail.garnishes.map((garnish) => `${garnish.kind}:${garnish.id}`),
    categoryIds: cocktail.categories.map((category) => category.id),
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function componentRowsFromCocktail(cocktail: CocktailCardResponseDto): CocktailComponentRow[] {
  return cocktail.components.map((component) => ({
    key: crypto.randomUUID(),
    productId: component.productId,
    product: productFromCocktailComponent(component),
    amount: String(component.amount),
    unitId: component.unitId,
  }));
}

function productFromCocktailComponent(
  component: CocktailCardResponseDto["components"][number],
): ProductSearchItem {
  return {
    id: component.productId,
    name: component.name,
    type: component.productType,
    venueId: component.productType === "PREPARATION" ? props.venueId : null,
    scope: component.productType === "PREPARATION" ? "VENUE" : "GLOBAL",
    matchReason: "EXACT_NAME",
    brand: null,
    categoryCode: null,
    strength: null,
  };
}

function requestVisibilityChange(visible: boolean): void {
  if (visible) {
    emit("update:visible", true);
    return;
  }
  if (dirty.value) {
    closeConfirmationVisible.value = true;
    return;
  }
  reset();
  emit("update:visible", false);
}

function discardAndClose(): void {
  closeConfirmationVisible.value = false;
  reset();
  emit("update:visible", false);
}

const submit = handleSubmit(async (values) => {
  saveError.value = "";
  componentErrors.value = [];
  const parsed = cocktailSchema.safeParse({
    ...values,
    components: components.value.map((component) => ({
      productId: component.productId,
      unitId: component.unitId || defaultComponentUnitId.value,
      amount: component.amount,
    })),
  });
  if (!parsed.success) {
    validationAttempted.value = true;
    components.value.forEach((component) => validatedComponentKeys.value.add(component.key));
    applyValidationErrors(parsed.error.issues);
    return;
  }

  saving.value = true;
  try {
    const input = toCreateDto(parsed.data);
    if (props.mode === "edit") {
      if (!props.cocktail) {
        saveError.value = "Не удалось загрузить коктейль для редактирования.";
        return;
      }
      const updated = await updateCocktail(props.cocktail.id, input as UpdateCocktailDto);
      reset();
      emit("update:visible", false);
      emit("updated", updated.id);
      return;
    }
    const created = await createCocktail(input);
    reset();
    emit("update:visible", false);
    emit("created", created.id);
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : "Не удалось создать коктейль.";
  } finally {
    saving.value = false;
  }
});

const cocktailAmountError =
  "Количество должно быть не менее 0,001 и содержать не более трёх знаков после запятой.";
const cocktailOutputAmountError =
  "Фактический выход должен быть не менее 0,001 и содержать не более трёх знаков после запятой.";

const cocktailComponentSchema = z.object({
  productId: z.string().uuid("Выберите ингредиент или заготовку."),
  unitId: z.string().uuid("Выберите единицу измерения."),
  amount: z
    .string()
    .trim()
    .min(1, "Укажите количество.")
    .refine((value) => parseCocktailAmount(value) !== null, cocktailAmountError)
    .transform((value) => parseCocktailAmount(value)!),
});

const cocktailComponentsSchema = z
  .array(cocktailComponentSchema)
  .min(1, "Добавьте хотя бы один компонент.")
  .max(20, "В коктейле может быть не более 20 компонентов.");

const cocktailSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Укажите название коктейля.")
      .max(160, "Название коктейля не должно превышать 160 символов."),
    glassId: z.string().uuid("Выберите бокал."),
    iceId: z.string().uuid("Выберите лёд."),
    preparationMethodId: z.string().uuid("Выберите метод приготовления."),
    technology: z
      .string()
      .trim()
      .min(1, "Опишите технологию приготовления.")
      .max(10000, "Технология приготовления не должна превышать 10 000 символов."),
    comment: z.string().max(2000, "Комментарий не должен превышать 2 000 символов."),
    outputAmount: z.string(),
    outputUnitId: z.string(),
    garnishIds: z
      .array(z.string().min(1, "Выберите гарнир."))
      .max(20, "Можно выбрать не более 20 гарниров."),
    categoryIds: z.array(z.string().uuid("Выберите категорию коктейля.")).max(20),
    components: cocktailComponentsSchema,
  })
  .superRefine((value, context) => {
    const hasOutput = Boolean(value.outputAmount.trim() || value.outputUnitId);
    if (!hasOutput) return;
    if (parseCocktailAmount(value.outputAmount) === null) {
      context.addIssue({
        code: "custom",
        path: ["outputAmount"],
        message: cocktailOutputAmountError,
      });
    }
    if (!value.outputUnitId) {
      context.addIssue({
        code: "custom",
        path: ["outputUnitId"],
        message: "Выберите единицу выхода.",
      });
    }
  });

function parseCocktailAmount(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/u.test(normalized)) {
    return null;
  }

  const decimalPlaces = normalized.split(".")[1]?.length ?? 0;
  const amount = Number(normalized);
  return decimalPlaces <= 3 && Number.isFinite(amount) && amount >= 0.001 ? amount : null;
}

function refreshValidationState(): void {
  const parsed = cocktailSchema.safeParse({
    ...values,
    components: components.value.map((component) => ({
      productId: component.productId,
      unitId: component.unitId || defaultComponentUnitId.value,
      amount: component.amount,
    })),
  });
  applyValidationErrors(parsed.success ? [] : parsed.error.issues);
}

function applyValidationErrors(issues: z.ZodIssue[]): void {
  const fieldErrors: Record<string, string> = {};
  const rows = components.value.map(() => ({ ingredient: false, amount: false, unit: false }));

  for (const issue of issues) {
    const [field, index, componentField] = issue.path;
    if (field === "components") {
      if (typeof index === "number") {
        if (!validatedComponentKeys.value.has(components.value[index]?.key ?? "")) continue;
        const row = rows[index];
        if (!row) continue;
        if (componentField === "productId") row.ingredient = true;
        else if (componentField === "amount") row.amount = true;
        else if (componentField === "unitId") row.unit = true;
        else rows[index] = { ingredient: true, amount: true, unit: true };
      } else {
        rows.forEach((_, rowIndex) => {
          if (validatedComponentKeys.value.has(components.value[rowIndex]?.key ?? "")) {
            rows[rowIndex] = { ingredient: true, amount: true, unit: true };
          }
        });
      }
    } else if (typeof field === "string") {
      fieldErrors[field] = issue.message;
    }
  }

  componentErrors.value = rows;
  const fieldNames: Array<keyof CocktailFormValues> = [
    "name",
    "glassId",
    "iceId",
    "preparationMethodId",
    "technology",
    "comment",
    "outputAmount",
    "outputUnitId",
    "garnishIds",
    "categoryIds",
  ];
  fieldNames.forEach((field) => setFieldError(field, fieldErrors[field]));
}

function toCreateDto(value: z.infer<typeof cocktailSchema>): CreateCocktailDto {
  const hasOutput = Boolean(value.outputAmount.trim() || value.outputUnitId);
  return {
    name: value.name.trim(),
    technology: value.technology.trim(),
    comment: value.comment.trim() || undefined,
    components: value.components,
    glassId: value.glassId,
    iceId: value.iceId,
    preparationMethodId: value.preparationMethodId,
    garnishSelections: value.garnishIds.map((key) => {
      const [kind, id] = key.split(":", 2);
      return { id: id!, kind: kind as "PRODUCT" | "QUICK" };
    }),
    categoryIds: value.categoryIds,
    output: hasOutput
      ? { amount: Number(value.outputAmount.replace(",", ".")), unitId: value.outputUnitId }
      : undefined,
  };
}
</script>

<style scoped>
@media (max-width: 639px) {
  :deep(.p-drawer.cocktail-drawer) {
    width: 100vw !important;
    max-width: 100vw;
  }
}
</style>
