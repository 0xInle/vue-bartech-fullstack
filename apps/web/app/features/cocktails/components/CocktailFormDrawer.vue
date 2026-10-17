<template>
  <Drawer
    :visible="visible"
    position="right"
    :style="{ width: 'min(100vw, 42rem)' }"
    class="cocktail-drawer"
    :header="mode === 'edit' ? 'Редактировать коктейль' : 'Создать коктейль'"
    @update:visible="requestVisibilityChange"
  >
    <form class="flex flex-col gap-5" @submit.prevent="submit">
      <Message v-if="saveError" severity="error" :closable="false">{{ saveError }}</Message>
      <Message v-if="referencesQuery.isError.value" severity="error" :closable="false">
        Не удалось загрузить справочники. Обновите страницу и попробуйте ещё раз.
      </Message>

      <div class="flex flex-col gap-2">
        <label for="cocktail-name" class="text-sm font-medium">Название</label>
        <InputText id="cocktail-name" v-model="name" size="small" fluid @input="markDirty" />
        <small v-if="errors.name" class="text-red-500">{{ errors.name }}</small>
      </div>

      <div class="flex flex-col gap-2">
        <div>
          <p class="text-sm font-medium">Состав</p>
          <p class="mt-1 text-xs text-color-secondary">Выберите ингредиенты или заготовки.</p>
        </div>
        <CocktailComponentRows
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
        />
        <small v-if="componentsError" class="text-red-500">{{ componentsError }}</small>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <div class="flex flex-col gap-2">
          <label for="cocktail-glass" class="text-sm font-medium">Бокал</label>
          <Select
            id="cocktail-glass"
            v-model="glassId"
            :options="glasses"
            option-label="label"
            option-value="id"
            placeholder="Выберите"
            size="small"
            fluid
            @update:model-value="markDirty"
          />
          <small v-if="errors.glassId" class="text-red-500">{{ errors.glassId }}</small>
        </div>
        <div class="flex flex-col gap-2">
          <label for="cocktail-ice" class="text-sm font-medium">Лёд</label>
          <Select
            id="cocktail-ice"
            v-model="iceId"
            :options="iceOptions"
            option-label="label"
            option-value="id"
            placeholder="Выберите"
            size="small"
            fluid
            @update:model-value="markDirty"
          />
          <small v-if="errors.iceId" class="text-red-500">{{ errors.iceId }}</small>
        </div>
        <div class="flex flex-col gap-2">
          <label for="cocktail-method" class="text-sm font-medium">Метод</label>
          <Select
            id="cocktail-method"
            v-model="preparationMethodId"
            :options="preparationMethods"
            option-label="label"
            option-value="id"
            placeholder="Выберите"
            size="small"
            fluid
            @update:model-value="markDirty"
          />
          <small v-if="errors.preparationMethodId" class="text-red-500">
            {{ errors.preparationMethodId }}
          </small>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <label for="cocktail-garnishes" class="text-sm font-medium">Гарниры</label>
        <MultiSelect
          id="cocktail-garnishes"
          v-model="garnishIds"
          :options="garnishesQuery.data.value ?? []"
          option-label="name"
          option-value="id"
          placeholder="Необязательно"
          size="small"
          fluid
          display="chip"
          :loading="garnishesQuery.isFetching.value"
          @update:model-value="markDirty"
        />
      </div>

      <div class="flex flex-col gap-2">
        <label for="cocktail-technology" class="text-sm font-medium"
          >Технология приготовления</label
        >
        <Textarea
          id="cocktail-technology"
          v-model="technology"
          rows="5"
          size="small"
          fluid
          @input="markDirty"
        />
        <small v-if="errors.technology" class="text-red-500">{{ errors.technology }}</small>
      </div>

      <div class="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <div class="flex flex-col gap-2">
          <label for="cocktail-output" class="text-sm font-medium">Фактический выход</label>
          <InputText
            id="cocktail-output"
            v-model="outputAmount"
            inputmode="decimal"
            size="small"
            placeholder="Необязательно"
            fluid
            @input="markDirty"
          />
          <small v-if="errors.outputAmount" class="text-red-500">{{ errors.outputAmount }}</small>
        </div>
        <div class="flex flex-col gap-2">
          <label for="cocktail-output-unit" class="text-sm font-medium">Единица</label>
          <Select
            id="cocktail-output-unit"
            v-model="outputUnitId"
            :options="references.units"
            option-label="label"
            option-value="id"
            placeholder="Выберите"
            size="small"
            fluid
            @update:model-value="markDirty"
          />
          <small v-if="errors.outputUnitId" class="text-red-500">{{ errors.outputUnitId }}</small>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <label for="cocktail-comment" class="text-sm font-medium">Комментарий</label>
        <Textarea
          id="cocktail-comment"
          v-model="comment"
          rows="3"
          size="small"
          placeholder="Необязательно"
          fluid
          @input="markDirty"
        />
      </div>

      <div class="flex justify-end gap-2 border-t border-surface pt-4">
        <Button
          label="Отмена"
          severity="secondary"
          variant="text"
          @click="requestVisibilityChange(false)"
        />
        <Button
          :label="mode === 'edit' ? 'Сохранить изменения' : 'Создать коктейль'"
          type="submit"
          :loading="saving"
          :disabled="referencesQuery.isLoading.value || referencesQuery.isError.value"
        />
      </div>
    </form>
  </Drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useForm } from "vee-validate";
import { z } from "zod";
import type {
  ProductsControllerCreateCocktailMutationBody as CreateCocktailDto,
  ProductsControllerUpdateCocktailMutationBody as UpdateCocktailDto,
} from "@bartech/api-client";
import CocktailComponentRows, { type CocktailComponentRow } from "./CocktailComponentRows.vue";
import { useCocktails, type CocktailCardResponseDto } from "../composables/useCocktails";
import type { ProductSearchItem } from "~/features/products/types";

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
};

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

const { createCocktail, createLocalIngredient, garnishesQuery, referencesQuery, updateCocktail } =
  useCocktails(
    () => props.companyId,
    () => props.venueId,
    { serviceSessionId: props.serviceSessionId },
  );
const { defineField, errors, handleSubmit, resetForm, setErrors } = useForm<CocktailFormValues>({
  initialValues: initialValues(),
});
const [name] = defineField("name");
const [glassId] = defineField("glassId");
const [iceId] = defineField("iceId");
const [preparationMethodId] = defineField("preparationMethodId");
const [technology] = defineField("technology");
const [comment] = defineField("comment");
const [outputAmount] = defineField("outputAmount");
const [outputUnitId] = defineField("outputUnitId");
const [garnishIds] = defineField("garnishIds");
const components = ref<CocktailComponentRow[]>([emptyComponent()]);
const dirty = ref(false);
const saving = ref(false);
const saveError = ref("");
const componentsError = ref("");
const componentErrors = ref<string[]>([]);

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
  references.value.referenceValues.filter((item) => item.type === "GLASS"),
);
const iceOptions = computed(() =>
  references.value.referenceValues.filter((item) => item.type === "ICE"),
);
const preparationMethods = computed(() =>
  references.value.referenceValues.filter((item) => item.type === "PREPARATION_METHOD"),
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
  };
}

function emptyComponent(): CocktailComponentRow {
  return { key: crypto.randomUUID(), productId: "", product: null, amount: "", unitId: "" };
}

function markDirty(): void {
  dirty.value = true;
}

function reset(): void {
  const cocktail = props.mode === "edit" ? props.cocktail : null;
  resetForm({ values: cocktail ? valuesFromCocktail(cocktail) : initialValues() });
  components.value = cocktail ? componentRowsFromCocktail(cocktail) : [emptyComponent()];
  dirty.value = false;
  saveError.value = "";
  componentsError.value = "";
  componentErrors.value = [];
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
    garnishIds: cocktail.garnishes.map((garnish) => garnish.id),
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
  if (dirty.value && !window.confirm("Закрыть форму и потерять введённые данные?")) return;
  reset();
  emit("update:visible", false);
}

const submit = handleSubmit(async (values) => {
  saveError.value = "";
  componentsError.value = "";
  componentErrors.value = [];
  setErrors({});
  const parsed = cocktailSchema.safeParse({
    ...values,
    components: components.value.map((component) => ({
      productId: component.productId,
      unitId: component.unitId,
      amount: Number(component.amount.replace(",", ".")),
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

const cocktailSchema = z
  .object({
    name: z.string().trim().min(1, "Укажите название коктейля.").max(160),
    glassId: z.string().uuid("Выберите бокал."),
    iceId: z.string().uuid("Выберите лёд."),
    preparationMethodId: z.string().uuid("Выберите метод приготовления."),
    technology: z.string().trim().min(1, "Опишите технологию приготовления.").max(10000),
    comment: z.string().max(2000),
    outputAmount: z.string(),
    outputUnitId: z.string(),
    garnishIds: z.array(z.string().uuid()).max(20),
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
    if (!Number.isFinite(amount) || amount <= 0) {
      context.addIssue({
        code: "custom",
        path: ["outputAmount"],
        message: "Укажите положительный выход.",
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
    garnishIds: value.garnishIds.length ? value.garnishIds : undefined,
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
