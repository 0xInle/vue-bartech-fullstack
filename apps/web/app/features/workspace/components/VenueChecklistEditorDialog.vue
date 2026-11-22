<template>
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    :dismissable-mask="!busy"
    :close-on-escape="!busy"
    :close-button-props="{ disabled: busy, severity: 'secondary', text: true, rounded: true }"
    :header="checklist ? 'Редактировать чек-лист' : 'Новый чек-лист'"
    class="dialog-size-md"
    :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
    @update:visible="emit('update:visible', $event)"
  >
    <form class="space-y-3" @submit.prevent="submit">
      <Message
        v-if="errorMessage"
        severity="error"
        size="small"
        :closable="false"
        :pt="compactMessagePt"
      >
        {{ errorMessage }}
      </Message>
      <div v-if="targetOptions" class="space-y-1 pt-2">
        <FloatLabel variant="on">
          <Select
            :id="targetSelectId"
            :model-value="target"
            :options="targetOptions"
            option-label="label"
            option-value="value"
            size="small"
            class="w-full"
            :disabled="busy"
            :invalid="targetInvalid"
            @update:model-value="emit('update:target', $event)"
          />
          <label :for="targetSelectId" class="text-xs">Куда создать</label>
        </FloatLabel>
      </div>
      <Message
        v-if="targetInvalid"
        severity="error"
        size="small"
        :closable="false"
        :pt="compactMessagePt"
      >
        Выберите заведение или все заведения компании.
      </Message>
      <div class="space-y-1 pt-2">
        <FloatLabel variant="on">
          <InputText
            id="venue-checklist-title"
            v-model="title"
            size="small"
            maxlength="100"
            class="w-full"
            :invalid="titleInvalid"
            :disabled="busy"
          />
          <label for="venue-checklist-title" class="text-xs">Название чек-листа</label>
        </FloatLabel>
      </div>
      <div class="space-y-2">
        <VueDraggable
          v-if="steps.length"
          v-model="steps"
          tag="div"
          :animation="150"
          handle=".checklist-step-drag-handle"
          ghost-class="checklist-step-ghost"
          chosen-class="checklist-step-chosen"
          drag-class="checklist-step-drag"
          fallback-class="checklist-step-fallback"
          :force-fallback="true"
          :fallback-on-body="true"
          :disabled="busy"
          class="max-h-80 space-y-1 overflow-y-auto"
        >
          <div
            v-for="(step, index) in steps"
            :key="step.id"
            class="checklist-step-row grid grid-cols-[1rem_1.25rem_minmax(0,1fr)_2rem] items-center gap-1 py-1"
          >
            <i
              class="pi pi-bars checklist-step-drag-handle cursor-grab text-color-secondary"
              aria-hidden="true"
            />
            <span class="text-right text-sm text-color-secondary" aria-hidden="true">
              {{ index + 1 }}.
            </span>
            <InputText
              :id="`venue-checklist-step-${step.id}`"
              v-model="step.text"
              size="small"
              maxlength="1000"
              placeholder="Название пункта"
              class="w-full min-w-0"
              :invalid="isStepInvalid(step, index)"
              :disabled="busy"
              :aria-label="`Пункт ${index + 1}`"
            />
            <Button
              icon="pi pi-trash"
              severity="secondary"
              variant="text"
              size="small"
              :disabled="busy"
              :aria-label="`Удалить пункт ${index + 1}`"
              @click="removeStep(step.id)"
            />
          </div>
        </VueDraggable>
        <Button
          label="Добавить пункт"
          icon="pi pi-plus"
          size="small"
          severity="secondary"
          variant="outlined"
          class="w-full"
          :disabled="busy || steps.length >= 50"
          @click="addStep()"
        />
      </div>
    </form>
    <template #footer>
      <Button
        label="Отмена"
        size="small"
        severity="secondary"
        variant="text"
        :disabled="busy"
        @click="emit('update:visible', false)"
      />
      <Button
        :label="checklist ? 'Сохранить' : 'Создать'"
        size="small"
        :loading="busy"
        :disabled="busy"
        @click="submit"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { VueDraggable } from "vue-draggable-plus";
import type { SaveVenueChecklistDto, VenueChecklistDto } from "@bartech/api-client";
import { compactMessagePt } from "~/utils/primevue-message";

type ChecklistStepDraft = { id: number; text: string };

const props = defineProps<{
  visible: boolean;
  checklist: VenueChecklistDto | null;
  busy: boolean;
  errorMessage: string;
  targetOptions?: Array<{ label: string; value: string }>;
  target?: string | null;
}>();
const emit = defineEmits<{
  "update:visible": [visible: boolean];
  "update:target": [target: string | null];
  submit: [input: SaveVenueChecklistDto];
}>();
const targetSelectId = useId();
const title = ref("");
const steps = ref<ChecklistStepDraft[]>([]);
let nextStepId = 0;
const attempted = ref(false);
const targetInvalid = ref(false);
const normalizedSteps = computed(() => steps.value.map((step) => step.text.trim()).filter(Boolean));
const titleInvalid = computed(
  () => attempted.value && (!title.value.trim() || title.value.trim().length > 100),
);
const stepsInvalid = computed(
  () =>
    attempted.value &&
    (!normalizedSteps.value.length ||
      steps.value.length > 50 ||
      steps.value.some((step) => step.text.trim().length > 1000)),
);

function isStepInvalid(step: ChecklistStepDraft, index: number): boolean {
  if (!attempted.value) return false;
  if (step.text.trim().length > 1000) return true;
  return !normalizedSteps.value.length && index === 0;
}

watch(
  () => [props.visible, props.checklist] as const,
  ([visible, checklist]) => {
    if (!visible) {
      attempted.value = false;
      targetInvalid.value = false;
      return;
    }
    title.value = checklist?.title ?? "";
    nextStepId = 0;
    steps.value = checklist?.steps.length ? checklist.steps.map(createStep) : [createStep("")];
    attempted.value = false;
  },
  { immediate: true },
);

function submit(): void {
  attempted.value = true;
  targetInvalid.value = Boolean(props.targetOptions && !props.target);
  if (targetInvalid.value) return;
  if (titleInvalid.value || stepsInvalid.value) return;
  emit("submit", { title: title.value.trim(), steps: normalizedSteps.value });
}

async function addStep(): Promise<void> {
  if (steps.value.length >= 50) return;
  const step = createStep("");
  steps.value.push(step);
  await nextTick();
  document.getElementById(`venue-checklist-step-${step.id}`)?.focus();
}

function createStep(text: string): ChecklistStepDraft {
  return { id: nextStepId++, text };
}

function removeStep(stepId: number): void {
  steps.value = steps.value.filter((step) => step.id !== stepId);
}
</script>

<style scoped>
.checklist-step-row {
  user-select: none;
  -webkit-user-select: none;
}

.checklist-step-row :deep(.p-inputtext) {
  user-select: text;
  -webkit-user-select: text;
}

.checklist-step-ghost {
  position: relative;
  color: transparent;
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
  user-select: none;
  -webkit-user-select: none;
}

.checklist-step-ghost > * {
  visibility: hidden;
}

:global(.checklist-step-fallback) {
  background: transparent !important;
  border: 0 !important;
  border-color: transparent !important;
  box-shadow: none !important;
  user-select: none;
  -webkit-user-select: none;
}

:global(.checklist-step-fallback *) {
  user-select: none;
  -webkit-user-select: none;
}

:global(.checklist-step-fallback .p-inputtext) {
  color: var(--p-text-color);
  background: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
}
</style>
