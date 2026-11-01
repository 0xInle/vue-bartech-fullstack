<template>
  <Drawer
    :visible="visible"
    :dismissable="!saving"
    position="right"
    block-scroll
    class="garnish-drawer drawer-size-md"
    :pt="{ content: { class: 'min-h-0' }, pcCloseButton: { root: { class: '!rounded-md' } } }"
    @update:visible="requestVisibilityChange"
  >
    <template #header="{ class: titleClass }">
      <span :class="[titleClass, 'leading-none']">
        {{ mode === "edit" ? "Редактировать гарнир" : "Создать гарнир" }}
      </span>
    </template>
    <LoadingIndicator v-if="referencesQuery.isLoading.value" class="py-8" />
    <form
      v-else
      id="garnish-form"
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
      >
        Не удалось загрузить справочники. Обновите страницу и попробуйте ещё раз.
      </Message>
      <div class="grid gap-4 pt-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div class="flex flex-col gap-2">
          <FloatLabel variant="on">
            <InputText
              id="garnish-name"
              v-model="name"
              size="small"
              fluid
              :invalid="Boolean(errors.name)"
              @input="markDirty"
            />
            <label for="garnish-name" class="text-xs">Название</label>
          </FloatLabel>
        </div>
        <FloatLabel variant="on">
          <Select
            v-model="workflowStatus"
            input-id="garnish-workflow-status"
            :options="workflowStatusOptions"
            option-label="label"
            option-value="value"
            size="small"
            fluid
            @update:model-value="markDirty"
          />
          <label for="garnish-workflow-status" class="text-xs">Статус</label>
        </FloatLabel>
      </div>
      <div class="flex flex-col gap-2">
        <GarnishComponentRows
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
          @dirty="markDirty"
          @update:model-value="markDirty"
          @local-ingredient-draft="hasLocalIngredientDraft = $event"
        />
      </div>
      <div class="flex flex-col gap-2">
        <FloatLabel variant="on">
          <Textarea
            id="garnish-technology"
            v-model="technology"
            rows="5"
            size="small"
            fluid
            class="block resize-none overflow-y-auto"
            :invalid="Boolean(errors.technology)"
            @input="markDirty"
          />
          <label for="garnish-technology" class="text-xs">Технология приготовления</label>
        </FloatLabel>
      </div>
      <div class="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <div class="flex flex-col gap-2">
          <FloatLabel variant="on">
            <InputText
              id="garnish-output"
              v-model="outputAmount"
              inputmode="decimal"
              size="small"
              fluid
              :invalid="Boolean(errors.outputAmount)"
              @input="markDirty"
            />
            <label for="garnish-output" class="text-xs">Фактический выход</label>
          </FloatLabel>
        </div>
        <div class="flex flex-col gap-2">
          <FloatLabel variant="on">
            <Select
              v-model="outputUnitId"
              input-id="garnish-output-unit"
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
            <label for="garnish-output-unit" class="text-xs">Ед. изм.</label>
          </FloatLabel>
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <FloatLabel variant="on">
          <Textarea
            id="garnish-comment"
            v-model="comment"
            rows="3"
            size="small"
            fluid
            class="block resize-none overflow-y-auto"
            :invalid="Boolean(errors.comment)"
            @input="markDirty"
          />
          <label for="garnish-comment" class="text-xs">Комментарий</label>
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
          form="garnish-form"
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
  <GarnishImpactDialog
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
  ProductsControllerCreateGarnishMutationBody as CreateGarnishDto,
  ProductsControllerUpdateGarnishMutationBody as UpdateGarnishDto,
} from "@bartech/api-client";
import type { ProductSearchItem } from "~/features/products/types";
import GarnishComponentRows, {
  type GarnishComponentErrors,
  type GarnishComponentRow,
} from "./GarnishComponentRows.vue";
import { useGarnishes } from "../composables/useGarnishes";
import GarnishImpactDialog from "./GarnishImpactDialog.vue";
import { compactMessagePt } from "~/utils/primevue-message";
import type { GarnishCardResponseDto, GarnishImpact } from "../composables/useGarnishes";

type Values = {
  name: string;
  workflowStatus: "ACTIVE" | "IN_DEVELOPMENT";
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
  garnish?: GarnishCardResponseDto | null;
}>();
const emit = defineEmits<{
  "update:visible": [visible: boolean];
  created: [garnishId: string];
  updated: [garnishId: string];
}>();
const { createGarnish, createLocalIngredient, referencesQuery, updateGarnish } = useGarnishes(
  () => props.companyId,
  () => props.venueId,
  { list: false, serviceSessionId: props.serviceSessionId },
);
const { defineField, errors, handleSubmit, resetForm, setErrors, values } = useForm<Values>({
  initialValues: initialValues(),
});
const [name] = defineField("name");
const [workflowStatus] = defineField("workflowStatus");
const [technology] = defineField("technology");
const [comment] = defineField("comment");
const [outputAmount] = defineField("outputAmount");
const [outputUnitId] = defineField("outputUnitId");
const dirty = ref(false);
const hasLocalIngredientDraft = ref(false);
const closeConfirmationVisible = ref(false);
const saving = ref(false);
const saveError = ref("");
const componentErrors = ref<GarnishComponentErrors[]>([]);
const validationAttempted = ref(false);
const validatedComponentKeys = ref(new Set<string>());
const amountConstraintMessage =
  "Количество должно быть не менее 0,001 и содержать не более трёх знаков после запятой.";
const componentRowsKey = ref(0);
const impact = ref<GarnishImpact | null>(null);
const pendingInput = ref<UpdateGarnishDto | null>(null);
const isChanged = computed(() =>
  props.mode !== "edit" || !props.garnish
    ? true
    : JSON.stringify(currentComparable()) !== JSON.stringify(cardComparable(props.garnish)),
);
const references = computed(
  () => referencesQuery.data.value ?? { units: [], ingredientCategories: [] },
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
function initialValues(): Values {
  return {
    name: "",
    workflowStatus: "IN_DEVELOPMENT",
    technology: "",
    comment: "",
    outputAmount: "",
    outputUnitId: "",
  };
}
const workflowStatusOptions = [
  { label: "Активен", value: "ACTIVE" },
  { label: "Проработка", value: "IN_DEVELOPMENT" },
];
function emptyComponent(): GarnishComponentRow {
  return {
    key: crypto.randomUUID(),
    productId: "",
    product: null,
    amount: "",
    unitId: defaultUnitId.value,
  };
}
const components = ref<GarnishComponentRow[]>([emptyComponent()]);
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
  const garnish = props.mode === "edit" ? props.garnish : null;
  resetForm({ values: garnish ? valuesFromCard(garnish) : initialValues() });
  components.value = garnish ? rowsFromCard(garnish) : [emptyComponent()];
  dirty.value = false;
  hasLocalIngredientDraft.value = false;
  closeConfirmationVisible.value = false;
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
  if (saving.value || !props.canManage) return;
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
      if (!props.garnish) {
        saveError.value = "Не удалось загрузить гарнир для редактирования.";
        return;
      }
      const result = await updateGarnish(props.garnish.id, input);
      if (result.kind === "confirmation") {
        pendingInput.value = input;
        impact.value = result.impact;
        return;
      }
      reset();
      emit("update:visible", false);
      emit("updated", result.garnish.id);
      return;
    }
    const created = await createGarnish(input);
    reset();
    emit("update:visible", false);
    emit("created", created.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const amountIndex = message.match(/components\.(\d+)\.amount/u)?.[1];
    if (amountIndex !== undefined) {
      validationAttempted.value = true;
      components.value.forEach((component) => validatedComponentKeys.value.add(component.key));
      refreshValidationState();
      saveError.value = `Проверьте количество компонентов. ${amountConstraintMessage}`;
    } else {
      saveError.value =
        props.mode === "edit"
          ? "Не удалось сохранить гарнир. Проверьте введённые данные и попробуйте ещё раз."
          : "Не удалось создать гарнир. Проверьте введённые данные и попробуйте ещё раз.";
    }
  } finally {
    saving.value = false;
  }
});
async function confirmImpact(): Promise<void> {
  if (!props.garnish || !impact.value || !pendingInput.value) return;
  saving.value = true;
  saveError.value = "";
  try {
    const result = await updateGarnish(props.garnish.id, {
      ...pendingInput.value,
      confirmationFingerprint: impact.value.confirmationFingerprint,
    });
    if (result.kind === "confirmation") {
      impact.value = result.impact;
      return;
    }
    reset();
    emit("update:visible", false);
    emit("updated", result.garnish.id);
  } catch {
    clearImpact();
    saveError.value =
      "Не удалось сохранить гарнир. Проверьте введённые данные и попробуйте ещё раз.";
  } finally {
    saving.value = false;
  }
}
function clearImpact(): void {
  impact.value = null;
  pendingInput.value = null;
}
function valuesFromCard(card: GarnishCardResponseDto): Values {
  return {
    name: card.name,
    workflowStatus: card.workflowStatus,
    technology: card.technology,
    comment: card.comment ?? "",
    outputAmount: card.output ? String(card.output.amount) : "",
    outputUnitId: card.output?.unitId ?? "",
  };
}
function rowsFromCard(card: GarnishCardResponseDto): GarnishComponentRow[] {
  return card.components.map((component) => ({
    key: crypto.randomUUID(),
    productId: component.productId,
    product: productFromComponent(component),
    amount: String(component.amount),
    unitId: component.unitId,
  }));
}
function productFromComponent(
  component: GarnishCardResponseDto["components"][number],
): ProductSearchItem {
  return {
    id: component.productId,
    name: component.name,
    type: component.productType,
    venueId: component.venueId,
    scope: component.venueId ? "VENUE" : "GLOBAL",
    matchReason: "EXACT_NAME",
    brand: null,
    categoryCode: null,
    strength: null,
  };
}
function currentComparable() {
  return comparable({
    name: name.value,
    workflowStatus: workflowStatus.value,
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
function cardComparable(card: GarnishCardResponseDto) {
  return comparable({
    ...valuesFromCard(card),
    components: card.components.map((component) => ({
      productId: component.productId,
      unitId: component.unitId,
      amount: component.amount,
    })),
  });
}
function comparable(value: Values & { components: CreateGarnishDto["components"] }) {
  return {
    name: value.name.trim().replace(/\s+/gu, " "),
    workflowStatus: value.workflowStatus,
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
    name: z
      .string()
      .trim()
      .min(1, "Укажите название гарнира.")
      .max(160, "Название не должно превышать 160 символов."),
    workflowStatus: z.enum(["ACTIVE", "IN_DEVELOPMENT"]),
    technology: z
      .string()
      .trim()
      .min(1, "Опишите технологию приготовления.")
      .max(10000, "Технология не должна превышать 10000 символов."),
    comment: z.string().max(2000, "Комментарий не должен превышать 2000 символов."),
    outputAmount: z.string(),
    outputUnitId: z.string(),
    components: z
      .array(
        z.object({
          productId: z.string().uuid("Выберите ингредиент или заготовку."),
          unitId: z.string().uuid("Выберите единицу измерения."),
          amount: z
            .number({ error: "Укажите количество компонента." })
            .min(0.001, amountConstraintMessage)
            .refine((value) => Number(value.toFixed(3)) === value, amountConstraintMessage),
        }),
      )
      .min(1, "Добавьте хотя бы один компонент.")
      .max(100, "Допустимо не более 100 компонентов."),
  })
  .superRefine((value, context) => {
    if (!value.outputAmount.trim() && !value.outputUnitId) return;
    const amount = Number(value.outputAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0)
      context.addIssue({
        code: "custom",
        path: ["outputAmount"],
        message: "Укажите положительный выход.",
      });
    if (!z.string().uuid().safeParse(value.outputUnitId).success)
      context.addIssue({
        code: "custom",
        path: ["outputUnitId"],
        message: "Выберите единицу выхода.",
      });
  });
function currentValues(): Values {
  return {
    name: name.value,
    workflowStatus: workflowStatus.value,
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
    name: undefined,
    workflowStatus: undefined,
    technology: undefined,
    comment: undefined,
    outputAmount: undefined,
    outputUnitId: undefined,
  };
  const rows = components.value.map(() => ({}) as GarnishComponentErrors);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [field, index, rowField] = issue.path;
      if (
        field === "components" &&
        typeof index === "number" &&
        (rowField === "productId" || rowField === "amount" || rowField === "unitId")
      ) {
        const row = rows[index];
        const key = components.value[index]?.key;
        if (row && key && validatedComponentKeys.value.has(key)) row[rowField] = true;
      } else if (field === "components" && validationAttempted.value && typeof index !== "number") {
        rows.forEach((row) => {
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
  componentErrors.value = rows;
}
function toCreateDto(value: z.infer<typeof schema>): CreateGarnishDto {
  return {
    name: value.name.trim(),
    workflowStatus: value.workflowStatus,
    technology: value.technology.trim(),
    comment: value.comment.trim() || undefined,
    components: value.components,
    output:
      value.outputAmount.trim() || value.outputUnitId
        ? { amount: Number(value.outputAmount.replace(",", ".")), unitId: value.outputUnitId }
        : undefined,
  };
}
</script>
