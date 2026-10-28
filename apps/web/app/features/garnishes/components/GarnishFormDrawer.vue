<template>
  <Drawer
    :visible="visible"
    position="right"
    class="garnish-drawer drawer-size-lg"
    :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
    @update:visible="requestVisibilityChange"
  >
    <template #header="{ class: titleClass }">
      <span :class="[titleClass, 'leading-none']">
        {{ mode === "edit" ? "Редактировать гарнир" : "Создать гарнир" }}
      </span>
    </template>
    <LoadingIndicator v-if="referencesQuery.isLoading.value" class="py-8" />
    <div v-else class="flex flex-col gap-5">
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
      <form id="garnish-form" class="flex flex-col gap-2" @submit.prevent="submit">
        <FloatLabel variant="on">
          <InputText id="garnish-name" v-model="name" size="small" fluid @input="markDirty" />
          <label for="garnish-name" class="text-xs">Название</label>
        </FloatLabel>
        <small v-if="errors.name" class="text-xs text-red-500">{{ errors.name }}</small>
      </form>
      <div class="flex flex-col gap-2">
        <div>
          <p class="text-sm font-medium">Состав</p>
          <p class="mt-1 text-xs text-color-secondary">Выберите ингредиенты или заготовки.</p>
        </div>
        <GarnishComponentRows
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
        />
        <small v-if="componentsError" class="text-xs text-red-500">{{ componentsError }}</small>
      </div>
      <div class="flex flex-col gap-2">
        <FloatLabel variant="on">
          <Textarea
            id="garnish-technology"
            v-model="technology"
            rows="5"
            size="small"
            fluid
            @input="markDirty"
          />
          <label for="garnish-technology" class="text-xs">Технология приготовления</label>
        </FloatLabel>
        <small v-if="errors.technology" class="text-xs text-red-500">{{ errors.technology }}</small>
      </div>
      <div class="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <div class="flex flex-col gap-2">
          <FloatLabel variant="on">
            <InputText
              id="garnish-output"
              v-model="outputAmount"
              inputmode="decimal"
              size="small"
              placeholder="Необязательно"
              fluid
              @input="markDirty"
            />
            <label for="garnish-output" class="text-xs">Фактический выход</label>
          </FloatLabel>
          <small v-if="errors.outputAmount" class="text-xs text-red-500">{{
            errors.outputAmount
          }}</small>
        </div>
        <div class="flex flex-col gap-2">
          <FloatLabel variant="on">
            <Select
              v-model="outputUnitId"
              input-id="garnish-output-unit"
              :options="references.units"
              option-label="label"
              option-value="id"
              size="small"
              fluid
              @update:model-value="markDirty"
            />
            <label for="garnish-output-unit" class="text-xs">Единица</label>
          </FloatLabel>
          <small v-if="errors.outputUnitId" class="text-xs text-red-500">{{
            errors.outputUnitId
          }}</small>
        </div>
      </div>
      <div class="flex flex-col gap-2">
        <FloatLabel variant="on">
          <Textarea
            id="garnish-comment"
            v-model="comment"
            rows="3"
            size="small"
            placeholder="Необязательно"
            fluid
            @input="markDirty"
          />
          <label for="garnish-comment" class="text-xs">Комментарий</label>
        </FloatLabel>
        <small v-if="errors.comment" class="text-xs text-red-500">{{ errors.comment }}</small>
      </div>
      <div class="flex justify-end gap-2">
        <Button
          label="Отмена"
          severity="secondary"
          variant="text"
          size="small"
          :disabled="saving"
          @click="requestVisibilityChange(false)"
        />
        <Button
          v-if="canManage"
          :label="mode === 'edit' ? 'Сохранить изменения' : 'Создать гарнир'"
          type="submit"
          size="small"
          form="garnish-form"
          :loading="saving"
          :disabled="
            saving ||
            referencesQuery.isLoading.value ||
            referencesQuery.isError.value ||
            (mode === 'edit' && !isChanged)
          "
        />
      </div>
    </div>
  </Drawer>
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
  type GarnishComponentRow,
  type GarnishComponentErrors,
} from "./GarnishComponentRows.vue";
import { useGarnishes } from "../composables/useGarnishes";
import GarnishImpactDialog from "./GarnishImpactDialog.vue";
import { compactMessagePt } from "~/utils/primevue-message";
import type { GarnishCardResponseDto, GarnishImpact } from "../composables/useGarnishes";

type Values = {
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
const { defineField, errors, handleSubmit, resetForm, setErrors } = useForm<Values>({
  initialValues: initialValues(),
});
const [name] = defineField("name");
const [technology] = defineField("technology");
const [comment] = defineField("comment");
const [outputAmount] = defineField("outputAmount");
const [outputUnitId] = defineField("outputUnitId");
const components = ref<GarnishComponentRow[]>([emptyComponent()]);
const dirty = ref(false);
const saving = ref(false);
const saveError = ref("");
const componentsError = ref("");
const componentErrors = ref<GarnishComponentErrors[]>([]);
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
function initialValues(): Values {
  return { name: "", technology: "", comment: "", outputAmount: "", outputUnitId: "" };
}
function emptyComponent(): GarnishComponentRow {
  return { key: crypto.randomUUID(), productId: "", product: null, amount: "", unitId: "" };
}
watch(
  () => props.visible,
  (visible) => {
    if (visible) reset();
    else saveError.value = "";
  },
);
function markDirty(): void {
  dirty.value = true;
  clearImpact();
}
function reset(): void {
  const garnish = props.mode === "edit" ? props.garnish : null;
  resetForm({ values: garnish ? valuesFromCard(garnish) : initialValues() });
  components.value = garnish ? rowsFromCard(garnish) : [emptyComponent()];
  dirty.value = false;
  clearImpact();
  saveError.value = "";
  componentsError.value = "";
  componentErrors.value = [];
}
function requestVisibilityChange(next: boolean): void {
  if (saving.value) return;
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
  if (saving.value || !props.canManage) return;
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
    const fieldErrors: Partial<Record<keyof Values, string>> = {};
    const rows: GarnishComponentErrors[] = [];
    for (const issue of parsed.error.issues) {
      const [field, index, rowField] = issue.path;
      if (
        field === "components" &&
        typeof index === "number" &&
        (rowField === "productId" || rowField === "amount" || rowField === "unitId")
      ) {
        rows[index] ??= {};
        rows[index][rowField] = issue.message;
      } else if (field === "components") componentsError.value = issue.message;
      else if (typeof field === "string" && field in initialValues())
        fieldErrors[field as keyof Values] = issue.message;
    }
    componentErrors.value = rows;
    setErrors(fieldErrors);
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
    saveError.value =
      error instanceof Error
        ? error.message
        : props.mode === "edit"
          ? "Не удалось сохранить гарнир."
          : "Не удалось создать гарнир.";
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
  } catch (error) {
    clearImpact();
    saveError.value = error instanceof Error ? error.message : "Не удалось сохранить гарнир.";
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
            .number({ error: "Укажите положительное количество." })
            .positive("Количество должно быть больше нуля."),
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
function toCreateDto(value: z.infer<typeof schema>): CreateGarnishDto {
  return {
    name: value.name.trim(),
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
