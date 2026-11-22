<template>
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    :dismissable-mask="!busy"
    :close-on-escape="!busy"
    :close-button-props="{ disabled: busy, severity: 'secondary', text: true, rounded: true }"
    :header="announcement ? 'Редактировать объявление' : 'Новое объявление'"
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
            id="venue-announcement-title"
            v-model="title"
            size="small"
            maxlength="100"
            class="w-full"
            :invalid="Boolean(titleError)"
            :disabled="busy"
            aria-describedby="venue-announcement-title-error"
          />
          <label for="venue-announcement-title" class="text-xs">Заголовок</label>
        </FloatLabel>
        <p
          v-if="titleError"
          id="venue-announcement-title-error"
          class="text-xs text-red-500"
          role="alert"
        >
          {{ titleError }}
        </p>
      </div>
      <div class="space-y-1 pt-2">
        <FloatLabel variant="on">
          <Textarea
            id="venue-announcement-body"
            v-model="body"
            size="small"
            rows="3"
            maxlength="1000"
            class="block w-full resize-none overflow-y-auto"
            :invalid="Boolean(bodyError)"
            :disabled="busy"
            aria-describedby="venue-announcement-body-error"
          />
          <label for="venue-announcement-body" class="text-xs">Текст объявления</label>
        </FloatLabel>
        <p
          v-if="bodyError"
          id="venue-announcement-body-error"
          class="text-xs text-red-500"
          role="alert"
        >
          {{ bodyError }}
        </p>
      </div>
      <p class="text-xs text-color-secondary">Увидят все сотрудники текущего заведения.</p>
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
        :label="announcement ? 'Сохранить' : 'Опубликовать'"
        size="small"
        :loading="busy"
        :disabled="busy"
        @click="submit"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { SaveVenueAnnouncementDto, VenueAnnouncementDto } from "@bartech/api-client";
import { compactMessagePt } from "~/utils/primevue-message";

const props = defineProps<{
  visible: boolean;
  announcement: VenueAnnouncementDto | null;
  busy: boolean;
  errorMessage: string;
  targetOptions?: Array<{ label: string; value: string }>;
  target?: string | null;
}>();
const emit = defineEmits<{
  "update:visible": [visible: boolean];
  "update:target": [target: string | null];
  submit: [input: SaveVenueAnnouncementDto];
}>();

const targetSelectId = useId();
const title = ref("");
const body = ref("");
const attempted = ref(false);
const targetInvalid = ref(false);
const titleError = computed(() => {
  if (!attempted.value) return "";
  if (!title.value.trim()) return "Укажите заголовок объявления.";
  if (title.value.trim().length > 100) return "Заголовок должен быть не длиннее 100 символов.";
  return "";
});
const bodyError = computed(() => {
  if (!attempted.value) return "";
  if (!body.value.trim()) return "Введите текст объявления.";
  if (body.value.trim().length > 1000) return "Текст должен быть не длиннее 1000 символов.";
  return "";
});

watch(
  () => [props.visible, props.announcement] as const,
  ([visible, announcement]) => {
    if (!visible) {
      attempted.value = false;
      targetInvalid.value = false;
      return;
    }
    title.value = announcement?.title ?? "";
    body.value = announcement?.body ?? "";
    attempted.value = false;
  },
  { immediate: true },
);

function submit(): void {
  attempted.value = true;
  targetInvalid.value = Boolean(props.targetOptions && !props.target);
  if (targetInvalid.value) return;
  if (titleError.value || bodyError.value) return;
  emit("submit", { title: title.value.trim(), body: body.value.trim() });
}
</script>
