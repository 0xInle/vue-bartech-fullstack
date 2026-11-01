<template>
  <FloatLabel variant="on">
    <Select
      ref="select"
      v-model="selectedValue"
      :input-id="inputId"
      append-to="self"
      :options="optionsWithCreated"
      option-label="name"
      option-value="code"
      size="small"
      fluid
      :invalid="invalid"
      :pt="{ overlay: { class: 'w-max min-w-full' } }"
      @show="handleShow"
      @hide="handleHide"
      @blur="emit('blur')"
    >
      <template #option="{ option }">
        <span class="block whitespace-nowrap">{{ option.name }}</span>
      </template>
      <template #footer>
        <div
          v-if="canCreate"
          class="box-border flex w-full min-w-0 max-w-full flex-col gap-2 p-2"
          @mousedown.stop
        >
          <Divider v-if="!creating" class="!my-0" />
          <template v-if="creating">
            <FloatLabel variant="on" class="w-full min-w-0">
              <InputText
                :id="`${inputId}-new-category`"
                v-model="newName"
                size="small"
                fluid
                class="min-w-0"
                maxlength="100"
                :disabled="saving"
                :invalid="validationAttempted && !newName.trim()"
                @keydown.enter.stop.prevent="save"
              />
              <label :for="`${inputId}-new-category`" class="text-xs">Название категории</label>
            </FloatLabel>
            <Message
              v-if="errorMessage"
              severity="error"
              size="small"
              :closable="false"
              :pt="compactMessagePt"
            >
              {{ errorMessage }}
            </Message>
            <div class="flex w-full min-w-0 flex-wrap justify-end gap-2">
              <Button
                label="Отмена"
                severity="secondary"
                variant="text"
                size="small"
                :disabled="saving"
                @click.stop="resetCreateForm"
              />
              <Button label="Добавить" size="small" :loading="saving" @click.stop="save" />
            </div>
          </template>
          <Button
            v-else
            type="button"
            label="Добавить категорию"
            icon="pi pi-plus"
            severity="secondary"
            variant="text"
            size="small"
            @mousedown.prevent
            @click.stop="beginCreate"
          />
        </div>
      </template>
    </Select>
    <label :for="inputId" class="text-xs">Категория</label>
  </FloatLabel>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import type { PreparationCategoryResponseDto } from "../composables/usePreparations";
import { compactMessagePt } from "~/utils/primevue-message";
import { compareCategoryNames } from "~/utils/category-order";
import {
  keepPrimeVueOverlayOpenOnScroll,
  keepPrimeVueOverlayWithinDrawer,
  type PrimeVueOverlayRef,
} from "~/utils/primevue-overlay";

const props = defineProps<{
  inputId: string;
  options: PreparationCategoryResponseDto[];
  canCreate: boolean;
  invalid?: boolean;
  create: (input: { name: string }) => Promise<PreparationCategoryResponseDto>;
}>();

const selectedValue = defineModel<string>({ default: "" });
const emit = defineEmits<{ blur: [] }>();
const select = ref<PrimeVueOverlayRef | null>(null);
const creating = ref(false);
const saving = ref(false);
const newName = ref("");
const errorMessage = ref("");
const validationAttempted = ref(false);
const createdOptions = ref<PreparationCategoryResponseDto[]>([]);
const optionsWithCreated = computed(() => {
  const options = new Map<string, PreparationCategoryResponseDto>();
  for (const option of [...props.options, ...createdOptions.value]) options.set(option.id, option);
  return [...options.values()].sort((first, second) =>
    compareCategoryNames(first.name, second.name),
  );
});

function beginCreate(): void {
  creating.value = true;
  newName.value = "";
  errorMessage.value = "";
  validationAttempted.value = false;
}

function resetCreateForm(): void {
  creating.value = false;
  newName.value = "";
  errorMessage.value = "";
  validationAttempted.value = false;
}

function handleHide(): void {
  resetCreateForm();
}

function handleShow(): void {
  keepPrimeVueOverlayOpenOnScroll(select.value);
  keepPrimeVueOverlayWithinDrawer(select.value);
}

async function save(): Promise<void> {
  const name = newName.value.trim().replace(/\s+/gu, " ");
  if (saving.value) return;
  validationAttempted.value = true;
  if (!name) {
    return;
  }
  saving.value = true;
  errorMessage.value = "";
  try {
    const created = await props.create({ name });
    createdOptions.value = [...createdOptions.value, created];
    selectedValue.value = created.code;
    resetCreateForm();
    await nextTick();
    select.value?.hide();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Не удалось добавить категорию.";
  } finally {
    saving.value = false;
  }
}
</script>
