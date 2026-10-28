<template>
  <FloatLabel variant="on">
    <MultiSelect
      ref="multiSelect"
      v-model="selectedKeys"
      :input-id="inputId"
      append-to="self"
      :options="availableOptions"
      option-label="name"
      option-value="key"
      :show-toggle-all="false"
      size="small"
      fluid
      filter
      filter-placeholder="Поиск гарниров"
      reset-filter-on-hide
      :invalid="invalid"
      :loading="loading"
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
          <span class="whitespace-nowrap">{{ option.name }}</span>
        </div>
      </template>
      <template #empty>
        <span class="text-xs text-color-secondary">Нет гарниров для выбора.</span>
      </template>
      <template #emptyfilter>
        <span class="text-xs text-color-secondary">Гарниры не найдены.</span>
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
                :id="`${inputId}-new-garnish`"
                v-model="newName"
                size="small"
                fluid
                class="min-w-0"
                maxlength="100"
                :disabled="saving"
                @keydown.enter.stop.prevent="save"
              />
              <label :for="`${inputId}-new-garnish`" class="text-xs">Название гарнира</label>
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
            label="Добавить гарнир"
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
    <label :for="inputId" class="text-xs">Гарнир</label>
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

type GarnishOption = { id: string; name: string; kind: "PRODUCT" | "QUICK" };

const props = defineProps<{
  inputId: string;
  options: GarnishOption[];
  canCreate: boolean;
  loading: boolean;
  invalid?: boolean;
  create: (input: CreateLocalReferenceValueDto) => Promise<ReferenceValueResponseDto>;
}>();
const multiSelect = ref<PrimeVueOverlayRef | null>(null);
const selectedKeys = defineModel<string[]>({ default: () => [] });
const creating = ref(false);
const saving = ref(false);
const newName = ref("");
const errorMessage = ref("");
const createdOptions = ref<GarnishOption[]>([]);
const availableOptions = computed(() => {
  const options = new Map<string, GarnishOption & { key: string }>();
  for (const option of [...props.options, ...createdOptions.value]) {
    const key = `${option.kind}:${option.id}`;
    options.set(key, { ...option, key });
  }
  return [...options.values()].sort((first, second) => first.name.localeCompare(second.name, "ru"));
});

function beginCreate(): void {
  creating.value = true;
  newName.value = "";
  errorMessage.value = "";
}

function resetCreateForm(): void {
  creating.value = false;
  newName.value = "";
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
  if (saving.value) return;

  const label = newName.value.trim().replace(/\s+/gu, " ");
  if (!label) {
    errorMessage.value = "Укажите название гарнира.";
    return;
  }

  saving.value = true;
  errorMessage.value = "";
  try {
    const created = await props.create({ type: "GARNISH", label });
    const option = { id: created.id, name: created.label, kind: "QUICK" as const };
    createdOptions.value = [
      ...createdOptions.value.filter((item) => item.id !== option.id),
      option,
    ];
    selectedKeys.value = [...selectedKeys.value, `QUICK:${option.id}`];
    resetCreateForm();
    await nextTick();
    multiSelect.value?.hide();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Не удалось добавить гарнир.";
  } finally {
    saving.value = false;
  }
}
</script>
