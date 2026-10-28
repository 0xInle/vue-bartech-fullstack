<template>
  <FloatLabel variant="on">
    <MultiSelect
      ref="multiSelect"
      v-model="selectedIds"
      :input-id="inputId"
      append-to="self"
      :options="optionsWithCreated"
      option-label="label"
      option-value="id"
      :show-toggle-all="false"
      size="small"
      fluid
      filter
      filter-placeholder="Поиск категорий"
      reset-filter-on-hide
      :invalid="invalid"
      :pt="{
        overlay: { class: 'w-max min-w-full' },
        pcOptionCheckbox: { root: { class: '!hidden' } },
      }"
      @show="handleShow"
      @hide="handleHide"
    >
      <template #option="{ option, selected }">
        <div class="flex items-center gap-2">
          <Checkbox
            :model-value="selected"
            binary
            size="small"
            class="pointer-events-none"
            :pt="{ root: { 'aria-hidden': true }, input: { tabindex: -1 } }"
          />
          <span class="whitespace-nowrap">{{ option.label }}</span>
        </div>
      </template>
      <template #empty>
        <span class="text-xs text-color-secondary">Нет категорий для выбора.</span>
      </template>
      <template #emptyfilter>
        <span class="text-xs text-color-secondary">Категории не найдены.</span>
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
                v-model="newLabel"
                size="small"
                fluid
                class="min-w-0"
                maxlength="100"
                :disabled="saving"
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
    </MultiSelect>
    <label :for="inputId" class="text-xs">Категория</label>
  </FloatLabel>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import type {
  ProductsControllerCreateReferenceValueMutationBody as CreateLocalReferenceValueDto,
  ReferenceValueResponseDto,
} from "@bartech/api-client";
import { compactMessagePt } from "~/utils/primevue-message";
import {
  keepPrimeVueOverlayOpenOnScroll,
  keepPrimeVueOverlayWithinDrawer,
  type PrimeVueOverlayRef,
} from "~/utils/primevue-overlay";

const props = defineProps<{
  inputId: string;
  options: ReferenceValueResponseDto[];
  canCreate: boolean;
  invalid?: boolean;
  create: (input: CreateLocalReferenceValueDto) => Promise<ReferenceValueResponseDto>;
}>();
const selectedIds = defineModel<string[]>({ default: () => [] });
const multiSelect = ref<PrimeVueOverlayRef | null>(null);
const creating = ref(false);
const saving = ref(false);
const newLabel = ref("");
const errorMessage = ref("");
const createdOptions = ref<ReferenceValueResponseDto[]>([]);
const optionsWithCreated = computed(() => {
  const options = new Map<string, ReferenceValueResponseDto>();
  for (const option of [...props.options, ...createdOptions.value]) options.set(option.id, option);
  return [...options.values()].sort((first, second) =>
    first.label.localeCompare(second.label, "ru"),
  );
});

function beginCreate(): void {
  creating.value = true;
  newLabel.value = "";
  errorMessage.value = "";
}

function resetCreateForm(): void {
  creating.value = false;
  newLabel.value = "";
  errorMessage.value = "";
}

function handleHide(): void {
  resetCreateForm();
}

function handleShow(): void {
  keepPrimeVueOverlayOpenOnScroll(multiSelect.value);
  keepPrimeVueOverlayWithinDrawer(multiSelect.value);
}

async function save(): Promise<void> {
  const label = newLabel.value.trim().replace(/\s+/gu, " ");
  if (saving.value) return;
  if (!label) {
    errorMessage.value = "Укажите название категории.";
    return;
  }
  saving.value = true;
  errorMessage.value = "";
  try {
    const created = await props.create({ type: "COCKTAIL_CATEGORY", label });
    createdOptions.value = [
      ...createdOptions.value.filter((item) => item.id !== created.id),
      created,
    ];
    selectedIds.value = [...selectedIds.value, created.id];
    resetCreateForm();
    await nextTick();
    multiSelect.value?.hide();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Не удалось добавить категорию.";
  } finally {
    saving.value = false;
  }
}
</script>
