<template>
  <Drawer
    :visible="visible"
    position="right"
    class="preparation-drawer drawer-size-lg"
    :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
    @update:visible="requestVisibilityChange"
  >
    <template #header="{ class: titleClass }">
      <span :class="[titleClass, 'leading-none']">
        {{ mode === "edit" ? "Редактировать заготовку" : "Создать заготовку" }}
      </span>
    </template>
    <LoadingIndicator v-if="referencesQuery.isLoading.value" class="py-8" />
    <form v-else class="flex flex-col gap-5" :inert="saving" @submit.prevent="submit">
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
      <div class="flex flex-col gap-2">
        <FloatLabel variant="on">
          <Select
            v-model="categoryCode"
            input-id="preparation-category"
            :options="references.preparationCategories"
            option-label="name"
            option-value="code"
            size="small"
            fluid
            @update:model-value="markDirty"
          />
          <label for="preparation-category" class="text-xs">Категория</label>
        </FloatLabel>
        <small v-if="errors.categoryCode" class="text-xs text-red-500">{{
          errors.categoryCode
        }}</small>
      </div>
      <div class="flex flex-col gap-2">
        <FloatLabel variant="on">
          <InputText id="preparation-name" v-model="name" size="small" fluid @input="markDirty" />
          <label for="preparation-name" class="text-xs">Название</label>
        </FloatLabel>
        <small v-if="errors.name" class="text-xs text-red-500">{{ errors.name }}</small>
      </div>
      <div class="flex flex-col gap-2">
        <div>
          <p class="text-sm font-medium">Состав</p>
          <p class="mt-1 text-xs text-color-secondary">Выберите ингредиенты или заготовки.</p>
        </div>
        <PreparationComponentRows
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
        /><small v-if="componentsError" class="text-xs text-red-500">{{ componentsError }}</small>
      </div>
      <div class="flex flex-col gap-2">
        <FloatLabel variant="on">
          <Textarea
            id="preparation-technology"
            v-model="technology"
            rows="5"
            size="small"
            fluid
            @input="markDirty"
          />
          <label for="preparation-technology" class="text-xs">Технология приготовления</label>
        </FloatLabel>
        <small v-if="errors.technology" class="text-xs text-red-500">{{ errors.technology }}</small>
      </div>
      <div class="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <div class="flex flex-col gap-2">
          <FloatLabel variant="on">
            <InputText
              id="preparation-output"
              v-model="outputAmount"
              inputmode="decimal"
              size="small"
              placeholder="Необязательно"
              fluid
              @input="markDirty"
            />
            <label for="preparation-output" class="text-xs">Фактический выход</label>
          </FloatLabel>
          <small v-if="errors.outputAmount" class="text-xs text-red-500">{{
            errors.outputAmount
          }}</small>
        </div>
        <div class="flex flex-col gap-2">
          <FloatLabel variant="on">
            <Select
              v-model="outputUnitId"
              input-id="preparation-output-unit"
              :options="references.units"
              option-label="label"
              option-value="id"
              size="small"
              fluid
              @update:model-value="markDirty"
            />
            <label for="preparation-output-unit" class="text-xs">Единица</label>
          </FloatLabel>
          <small v-if="errors.outputUnitId" class="text-xs text-red-500">{{
            errors.outputUnitId
          }}</small>
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <FloatLabel variant="on">
          <Textarea
            id="preparation-comment"
            v-model="comment"
            rows="3"
            size="small"
            placeholder="Необязательно"
            fluid
            @input="markDirty"
          />
          <label for="preparation-comment" class="text-xs">Комментарий</label>
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
          :label="mode === 'edit' ? 'Сохранить изменения' : 'Создать заготовку'"
          type="submit"
          size="small"
          :loading="saving"
          :disabled="
            referencesQuery.isLoading.value ||
            referencesQuery.isError.value ||
            (mode === 'edit' && !isChanged)
          "
        />
      </div>
    </form>
  </Drawer>
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
  type PreparationComponentRow,
} from "./PreparationComponentRows.vue";
import PreparationImpactDialog from "./PreparationImpactDialog.vue";
import { compactMessagePt } from "~/utils/primevue-message";
import {
  usePreparations,
  type PreparationCardResponseDto,
  type PreparationImpact,
} from "../composables/usePreparations";
type Values = {
  categoryCode: string;
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
const { createPreparation, createLocalIngredient, referencesQuery, updatePreparation } =
  usePreparations(
    () => props.companyId,
    () => props.venueId,
    { serviceSessionId: props.serviceSessionId },
  );
const { defineField, errors, handleSubmit, resetForm, setErrors } = useForm<Values>({
  initialValues: initialValues(),
});
const [categoryCode] = defineField("categoryCode");
const [name] = defineField("name");
const [technology] = defineField("technology");
const [comment] = defineField("comment");
const [outputAmount] = defineField("outputAmount");
const [outputUnitId] = defineField("outputUnitId");
const components = ref<PreparationComponentRow[]>([emptyComponent()]);
const dirty = ref(false);
const saving = ref(false);
const saveError = ref("");
const componentsError = ref("");
const componentErrors = ref<string[]>([]);
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
watch(
  () => props.visible,
  (visible) => {
    if (visible) reset();
    else saveError.value = "";
  },
);
function initialValues(): Values {
  return {
    categoryCode: "",
    name: "",
    technology: "",
    comment: "",
    outputAmount: "",
    outputUnitId: "",
  };
}
function emptyComponent(): PreparationComponentRow {
  return { key: crypto.randomUUID(), productId: "", product: null, amount: "", unitId: "" };
}
function markDirty(): void {
  dirty.value = true;
  clearImpact();
}
function reset(): void {
  const preparation = props.mode === "edit" ? props.preparation : null;
  resetForm({ values: preparation ? valuesFromCard(preparation) : initialValues() });
  components.value = preparation ? rowsFromCard(preparation) : [emptyComponent()];
  dirty.value = false;
  clearImpact();
  saveError.value = "";
  componentsError.value = "";
  componentErrors.value = [];
}
function requestVisibilityChange(next: boolean): void {
  if (next) {
    emit("update:visible", true);
    return;
  }
  if (
    (props.mode === "edit" ? isChanged.value : dirty.value) &&
    !window.confirm("Закрыть форму и потерять введённые данные?")
  )
    return;
  reset();
  emit("update:visible", false);
}
const submit = handleSubmit(async (values) => {
  saveError.value = "";
  componentsError.value = "";
  componentErrors.value = [];
  setErrors({});
  const parsed = schema.safeParse({
    ...values,
    components: components.value.map((item) => ({
      productId: item.productId,
      unitId: item.unitId,
      amount: Number(item.amount.replace(",", ".")),
    })),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    const rows: string[] = [];
    for (const issue of parsed.error.issues) {
      const [field, index] = issue.path;
      if (field === "components" && typeof index === "number") rows[index] = issue.message;
      else if (field === "components") componentsError.value = issue.message;
      else if (typeof field === "string") fieldErrors[field] = issue.message;
    }
    componentErrors.value = rows;
    setErrors(fieldErrors);
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
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : "Не удалось создать заготовку.";
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
  } catch (error) {
    clearImpact();
    saveError.value = error instanceof Error ? error.message : "Не удалось сохранить заготовку.";
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
          amount: z.number().positive("Количество должно быть больше нуля."),
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
function toCreateDto(value: z.infer<typeof schema>): CreatePreparationDto {
  const hasOutput = Boolean(value.outputAmount.trim() || value.outputUnitId);
  return {
    categoryCode: value.categoryCode,
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
