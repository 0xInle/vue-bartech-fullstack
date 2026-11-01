<template>
  <Drawer
    :visible="visible"
    :dismissable="!saving"
    position="right"
    block-scroll
    class="preparation-drawer drawer-size-md"
    :pt="{ content: { class: 'min-h-0' }, pcCloseButton: { root: { class: '!rounded-md' } } }"
    @update:visible="requestVisibilityChange"
  >
    <template #header="{ class: titleClass }">
      <span :class="[titleClass, 'leading-none']">
        {{ mode === "edit" ? "Редактировать заготовку" : "Создать заготовку" }}
      </span>
    </template>
    <LoadingIndicator v-if="referencesQuery.isLoading.value" class="py-8" />
    <form
      v-else
      id="preparation-form"
      class="flex flex-col gap-5 pt-3"
      :inert="saving"
      @submit.prevent="submit"
    >
      <Message v-if="saveError" severity="error" :closable="false" :pt="compactMessagePt">
        {{ saveError }}
      </Message>
      <Message
        v-if="referencesQuery.isError.value"
        severity="error"
        :closable="false"
        :pt="compactMessagePt"
        >Не удалось загрузить справочники. Обновите страницу и попробуйте ещё раз.</Message
      >
      <div class="grid gap-4 pt-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div class="flex flex-col gap-2">
          <FloatLabel variant="on">
            <InputText
              id="preparation-name"
              v-model="name"
              size="small"
              fluid
              :invalid="Boolean(errors.name)"
              @input="markDirty"
            />
            <label for="preparation-name" class="text-xs">Название</label>
          </FloatLabel>
        </div>
        <FloatLabel variant="on">
          <Select
            v-model="workflowStatus"
            input-id="preparation-workflow-status"
            :options="workflowStatusOptions"
            option-label="label"
            option-value="value"
            size="small"
            fluid
            @update:model-value="markDirty"
          />
          <label for="preparation-workflow-status" class="text-xs">Статус</label>
        </FloatLabel>
      </div>
      <div class="flex flex-col gap-2">
        <PreparationComponentRows
          :key="componentRowsKey"
          v-model="components"
          :company-id="companyId"
          :venue-id="venueId"
          :service-session-id="serviceSessionId"
          :units="references.units"
          :ingredient-categories="references.ingredientCategories"
          :errors="componentErrors"
          :can-manage="canManage"
          :create-local-ingredient="createLocalIngredient"
          @update:model-value="markDirty"
          @dirty="markDirty"
          @local-ingredient-draft="hasLocalIngredientDraft = $event"
        />
      </div>
      <div class="flex flex-col gap-2">
        <FloatLabel variant="on">
          <Textarea
            id="preparation-technology"
            v-model="technology"
            rows="5"
            size="small"
            fluid
            class="block resize-none overflow-y-auto"
            :invalid="Boolean(errors.technology)"
            @input="markDirty"
          />
          <label for="preparation-technology" class="text-xs">Технология приготовления</label>
        </FloatLabel>
      </div>
      <div class="flex flex-col gap-2">
        <PreparationCategorySelect
          v-model="categoryCode"
          input-id="preparation-category"
          :options="references.preparationCategories"
          :can-create="canManage"
          :create="createLocalPreparationCategory"
          :invalid="Boolean(errors.categoryCode)"
          @update:model-value="markDirty"
        />
      </div>
      <div class="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <div class="flex flex-col gap-2">
          <FloatLabel variant="on">
            <InputText
              id="preparation-output"
              v-model="outputAmount"
              inputmode="decimal"
              size="small"
              fluid
              :invalid="Boolean(errors.outputAmount)"
              @input="markDirty"
            />
            <label for="preparation-output" class="text-xs">Фактический выход</label>
          </FloatLabel>
        </div>
        <div class="flex flex-col gap-2">
          <FloatLabel variant="on">
            <Select
              v-model="outputUnitId"
              input-id="preparation-output-unit"
              :options="availableUnits"
              option-label="label"
              option-value="id"
              size="small"
              fluid
              :invalid="Boolean(errors.outputUnitId)"
              @update:model-value="markDirty"
            >
              <template #value="slotProps">
                {{ unitLabel(outputUnitId) || slotProps.placeholder }}
              </template>
            </Select>
            <label for="preparation-output-unit" class="text-xs">Ед. изм.</label>
          </FloatLabel>
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <FloatLabel variant="on">
          <Textarea
            id="preparation-comment"
            v-model="comment"
            rows="3"
            size="small"
            fluid
            class="block resize-none overflow-y-auto"
            :invalid="Boolean(errors.comment)"
            @input="markDirty"
          />
          <label for="preparation-comment" class="text-xs">Комментарий</label>
        </FloatLabel>
      </div>
    </form>
    <template v-if="!referencesQuery.isLoading.value" #footer>
      <div class="flex w-full justify-end gap-2">
        <Button
          label="Отмена"
          type="button"
          severity="secondary"
          variant="text"
          size="small"
          :disabled="saving"
          @click="requestVisibilityChange(false)"
        />
        <Button
          v-if="canManage"
          label="Сохранить"
          form="preparation-form"
          type="submit"
          size="small"
          :loading="saving"
          :disabled="
            saving ||
            referencesQuery.isLoading.value ||
            referencesQuery.isError.value ||
            (mode === 'edit' && !isChanged)
          "
        />
      </div>
    </template>
  </Drawer>
  <Dialog
    v-model:visible="closeConfirmationVisible"
    modal
    dismissable-mask
    header="Закрыть форму?"
    class="dialog-size-sm"
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
  <PreparationImpactDialog
    :visible="Boolean(impact)"
    :products="impact?.affectedProducts ?? []"
    :saving="saving"
    @cancel="clearImpact"
    @confirm="confirmImpact"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useForm } from "vee-validate";
import { z } from "zod";
import type {
  ProductsControllerCreatePreparationMutationBody as CreatePreparationDto,
  ProductsControllerUpdatePreparationMutationBody as UpdatePreparationDto,
} from "@bartech/api-client";
import type { ProductSearchItem } from "~/features/products/types";
import PreparationComponentRows, {
  type PreparationComponentError,
  type PreparationComponentRow,
} from "./PreparationComponentRows.vue";
import PreparationCategorySelect from "./PreparationCategorySelect.vue";
import PreparationImpactDialog from "./PreparationImpactDialog.vue";
import { compactMessagePt } from "~/utils/primevue-message";
import {
  usePreparations,
  type PreparationCardResponseDto,
  type PreparationImpact,
} from "../composables/usePreparations";
type Values = {
  categoryCode: string;
  workflowStatus: "ACTIVE" | "IN_DEVELOPMENT";
  name: string;
  technology: string;
  comment: string;
  outputAmount: string;
  outputUnitId: string;
};
const props = defineProps<{
  companyId: string;
  venueId: string;
  serviceSessionId?: string;
  visible: boolean;
  canManage: boolean;
  mode: "create" | "edit";
  preparation?: PreparationCardResponseDto | null;
}>();
const emit = defineEmits<{
  "update:visible": [visible: boolean];
  created: [preparationId: string];
  updated: [preparationId: string];
}>();
const {
  createPreparation,
  createLocalIngredient,
  createLocalPreparationCategory,
  referencesQuery,
  updatePreparation,
} = usePreparations(
  () => props.companyId,
  () => props.venueId,
  { serviceSessionId: props.serviceSessionId },
);
const { defineField, errors, handleSubmit, resetForm, setErrors, values } = useForm<Values>({
  initialValues: initialValues(),
});
const [categoryCode] = defineField("categoryCode");
const [workflowStatus] = defineField("workflowStatus");
const [name] = defineField("name");
const [technology] = defineField("technology");
const [comment] = defineField("comment");
const [outputAmount] = defineField("outputAmount");
const [outputUnitId] = defineField("outputUnitId");
const dirty = ref(false);
const hasLocalIngredientDraft = ref(false);
const closeConfirmationVisible = ref(false);
const saving = ref(false);
const saveError = ref("");
const componentErrors = ref<PreparationComponentError[]>([]);
const validationAttempted = ref(false);
const validatedComponentKeys = ref(new Set<string>());
const componentRowsKey = ref(0);
const impact = ref<PreparationImpact | null>(null);
const pendingInput = ref<UpdatePreparationDto | null>(null);
const isChanged = computed(() => {
  if (props.mode !== "edit" || !props.preparation) return true;
  return JSON.stringify(currentComparable()) !== JSON.stringify(cardComparable(props.preparation));
});
const references = computed(
  () =>
    referencesQuery.data.value ?? {
      units: [],
      ingredientCategories: [],
      preparationCategories: [],
      referenceValues: [],
    },
);
const availableUnits = computed(() =>
  references.value.units.filter((unit) => unit.code !== "bar-spoon"),
);
const defaultUnitId = computed(
  () =>
    references.value.units.find((unit) => unit.label.trim().toLocaleLowerCase("ru") === "мл")?.id ??
    "",
);
function unitLabel(unitId: string): string {
  return references.value.units.find((unit) => unit.id === unitId)?.label ?? "";
}
const workflowStatusOptions = [
  { label: "Активен", value: "ACTIVE" },
  { label: "Проработка", value: "IN_DEVELOPMENT" },
];
function initialValues(): Values {
  return {
    categoryCode: "",
    workflowStatus: "IN_DEVELOPMENT",
    name: "",
    technology: "",
    comment: "",
    outputAmount: "",
    outputUnitId: "",
  };
}
function emptyComponent(): PreparationComponentRow {
  return {
    key: crypto.randomUUID(),
    productId: "",
    product: null,
    amount: "",
    unitId: defaultUnitId.value,
  };
}
const components = ref<PreparationComponentRow[]>([emptyComponent()]);
watch(defaultUnitId, (unitId) => {
  if (!unitId || props.mode !== "create") return;
  components.value = components.value.map((component) =>
    component.unitId ? component : { ...component, unitId },
  );
});
watch(
  () => props.visible,
  (visible) => {
    if (visible) reset();
    else saveError.value = "";
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
function markDirty(): void {
  dirty.value = true;
  clearImpact();
}
function reset(): void {
  componentRowsKey.value += 1;
  closeConfirmationVisible.value = false;
  const preparation = props.mode === "edit" ? props.preparation : null;
  resetForm({ values: preparation ? valuesFromCard(preparation) : initialValues() });
  components.value = preparation ? rowsFromCard(preparation) : [emptyComponent()];
  dirty.value = false;
  hasLocalIngredientDraft.value = false;
  clearImpact();
  saveError.value = "";
  componentErrors.value = [];
  validationAttempted.value = false;
  validatedComponentKeys.value.clear();
}
function requestVisibilityChange(next: boolean): void {
  if (saving.value) return;
  if (next) {
    emit("update:visible", true);
    return;
  }
  if (props.mode === "edit" ? isChanged.value || hasLocalIngredientDraft.value : dirty.value) {
    closeConfirmationVisible.value = true;
    return;
  }
  closeForm();
}
function closeForm(): void {
  closeConfirmationVisible.value = false;
  reset();
  emit("update:visible", false);
}
function discardAndClose(): void {
  closeForm();
}
const submit = handleSubmit(async (values) => {
  if (!props.canManage) return;
  saveError.value = "";
  const parsed = schema.safeParse({
    ...values,
    components: components.value.map((item) => ({
      productId: item.productId,
      unitId: item.unitId,
      amount: Number(item.amount.replace(",", ".")),
    })),
  });
  if (!parsed.success) {
    validationAttempted.value = true;
    components.value.forEach((component) => validatedComponentKeys.value.add(component.key));
    refreshValidationState(values);
    return;
  }
  saving.value = true;
  try {
    const input = toCreateDto(parsed.data);
    if (props.mode === "edit") {
      if (!props.preparation) {
        saveError.value = "Не удалось загрузить заготовку для редактирования.";
        return;
      }
      const result = await updatePreparation(props.preparation.id, input);
      if (result.kind === "confirmation") {
        pendingInput.value = input;
        impact.value = result.impact;
        return;
      }
      reset();
      emit("update:visible", false);
      emit("updated", result.preparation.id);
      return;
    }
    const created = await createPreparation(input);
    reset();
    emit("update:visible", false);
    emit("created", created.id);
  } catch {
    saveError.value =
      props.mode === "edit"
        ? "Не удалось сохранить заготовку. Проверьте введённые данные и попробуйте ещё раз."
        : "Не удалось создать заготовку. Проверьте введённые данные и попробуйте ещё раз.";
  } finally {
    saving.value = false;
  }
});
async function confirmImpact(): Promise<void> {
  if (!props.preparation || !impact.value || !pendingInput.value) return;
  saving.value = true;
  saveError.value = "";
  try {
    const result = await updatePreparation(props.preparation.id, {
      ...pendingInput.value,
      confirmationFingerprint: impact.value.confirmationFingerprint,
    });
    if (result.kind === "confirmation") {
      impact.value = result.impact;
      return;
    }
    reset();
    emit("update:visible", false);
    emit("updated", result.preparation.id);
  } catch {
    clearImpact();
    saveError.value = "Не удалось сохранить заготовку. Попробуйте ещё раз.";
  } finally {
    saving.value = false;
  }
}
function clearImpact(): void {
  impact.value = null;
  pendingInput.value = null;
}

function valuesFromCard(card: PreparationCardResponseDto): Values {
  return {
    categoryCode: card.categoryCode,
    workflowStatus: card.workflowStatus,
    name: card.name,
    technology: card.technology,
    comment: card.comment ?? "",
    outputAmount: card.output ? String(card.output.amount) : "",
    outputUnitId: card.output?.unitId ?? "",
  };
}
function rowsFromCard(card: PreparationCardResponseDto): PreparationComponentRow[] {
  return card.components.map((component) => ({
    key: crypto.randomUUID(),
    productId: component.productId,
    product: productFromComponent(component),
    amount: String(component.amount),
    unitId: component.unitId,
  }));
}
function productFromComponent(
  component: PreparationCardResponseDto["components"][number],
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
function currentComparable() {
  return comparable({
    categoryCode: categoryCode.value,
    workflowStatus: workflowStatus.value,
    name: name.value,
    technology: technology.value,
    comment: comment.value,
    outputAmount: outputAmount.value,
    outputUnitId: outputUnitId.value,
    components: components.value.map((component) => ({
      productId: component.productId,
      unitId: component.unitId,
      amount: Number(component.amount.replace(",", ".")),
    })),
  });
}
function cardComparable(card: PreparationCardResponseDto) {
  return comparable({
    ...valuesFromCard(card),
    components: card.components.map((component) => ({
      productId: component.productId,
      unitId: component.unitId,
      amount: component.amount,
    })),
  });
}
function comparable(value: Values & { components: CreatePreparationDto["components"] }) {
  return {
    categoryCode: value.categoryCode.trim().toLowerCase(),
    workflowStatus: value.workflowStatus,
    name: value.name.trim().replace(/\s+/gu, " "),
    technology: value.technology.trim(),
    comment: value.comment.trim() || null,
    output:
      value.outputAmount.trim() || value.outputUnitId
        ? { amount: Number(value.outputAmount.replace(",", ".")), unitId: value.outputUnitId }
        : null,
    components: value.components,
  };
}
const schema = z
  .object({
    categoryCode: z.string().min(1, "Выберите категорию."),
    workflowStatus: z.enum(["ACTIVE", "IN_DEVELOPMENT"]),
    name: z.string().trim().min(1, "Укажите название заготовки.").max(160),
    technology: z.string().trim().min(1, "Опишите технологию приготовления.").max(10000),
    comment: z.string().max(2000),
    outputAmount: z.string(),
    outputUnitId: z.string(),
    components: z
      .array(
        z.object({
          productId: z.string().uuid("Выберите ингредиент или заготовку."),
          unitId: z.string().uuid("Выберите единицу измерения."),
          amount: z
            .number({ error: "Укажите количество компонента." })
            .min(0.001, "Количество должно быть не менее 0,001.")
            .refine(
              (value) => Number(value.toFixed(3)) === value,
              "Допустимо не более трёх знаков после запятой.",
            ),
        }),
      )
      .min(1, "Добавьте хотя бы один компонент."),
  })
  .superRefine((value, context) => {
    const hasOutput = Boolean(value.outputAmount.trim() || value.outputUnitId);
    if (!hasOutput) return;
    const amount = Number(value.outputAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0)
      context.addIssue({
        code: "custom",
        path: ["outputAmount"],
        message: "Укажите положительный выход.",
      });
    if (!value.outputUnitId)
      context.addIssue({
        code: "custom",
        path: ["outputUnitId"],
        message: "Выберите единицу выхода.",
      });
  });
function currentValues(): Values {
  return {
    categoryCode: categoryCode.value,
    workflowStatus: workflowStatus.value,
    name: name.value,
    technology: technology.value,
    comment: comment.value,
    outputAmount: outputAmount.value,
    outputUnitId: outputUnitId.value,
  };
}
function refreshValidationState(values = currentValues()): void {
  const parsed = schema.safeParse({
    ...values,
    components: components.value.map((item) => ({
      productId: item.productId,
      unitId: item.unitId,
      amount: Number(item.amount.replace(",", ".")),
    })),
  });
  const fieldErrors: Partial<Record<keyof Values, string | undefined>> = {
    categoryCode: undefined,
    workflowStatus: undefined,
    name: undefined,
    technology: undefined,
    comment: undefined,
    outputAmount: undefined,
    outputUnitId: undefined,
  };
  const componentFieldErrors = components.value.map(() => ({}) as PreparationComponentError);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [field, index, componentField] = issue.path;
      if (
        field === "components" &&
        typeof index === "number" &&
        (componentField === "productId" ||
          componentField === "amount" ||
          componentField === "unitId")
      ) {
        const row = componentFieldErrors[index];
        const key = components.value[index]?.key;
        if (row && key && validatedComponentKeys.value.has(key)) row[componentField] = true;
      } else if (field === "components" && validationAttempted.value && typeof index !== "number") {
        componentFieldErrors.forEach((row) => {
          row.productId = true;
          row.amount = true;
          row.unitId = true;
        });
      } else if (
        typeof field === "string" &&
        field in initialValues() &&
        validationAttempted.value
      ) {
        fieldErrors[field as keyof Values] = issue.message;
      }
    }
  }
  setErrors(fieldErrors);
  componentErrors.value = componentFieldErrors;
}
function toCreateDto(value: z.infer<typeof schema>): CreatePreparationDto {
  const hasOutput = Boolean(value.outputAmount.trim() || value.outputUnitId);
  return {
    categoryCode: value.categoryCode,
    workflowStatus: value.workflowStatus,
    name: value.name.trim(),
    technology: value.technology.trim(),
    comment: value.comment.trim() || undefined,
    components: value.components,
    output: hasOutput
      ? { amount: Number(value.outputAmount.replace(",", ".")), unitId: value.outputUnitId }
      : undefined,
  };
}
</script>
<style scoped>
@media (max-width: 639px) {
  :deep(.p-drawer.preparation-drawer) {
    width: 100vw !important;
    max-width: 100vw;
  }
}
</style>
