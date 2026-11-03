<template>
  <Dialog
    :visible="visible"
    modal
    closable
    :close-on-escape="!isPending"
    :dismissable-mask="!isPending"
    :draggable="false"
    header="Выгрузка продукции"
    class="dialog-size-sm"
    :close-button-props="{ disabled: isPending, severity: 'secondary', text: true, rounded: true }"
    :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
    @update:visible="emit('close')"
  >
    <div v-if="isPending" class="flex flex-col items-center gap-3 py-4">
      <LoadingIndicator class="w-auto" />
      <p class="text-sm text-color-secondary">{{ pendingText }}</p>
    </div>
    <Message v-else-if="statusError || errorMessage" severity="error" :closable="false">
      {{
        errorMessage || "Не удалось получить состояние выгрузки. Закройте окно и повторите запрос."
      }}
    </Message>
    <Message v-else-if="request?.status === 'FAILED'" severity="error" :closable="false">
      Не удалось подготовить файл. Закройте окно и создайте новую выгрузку.
    </Message>
    <Message v-else-if="request?.status === 'EXPIRED'" severity="warn" :closable="false">
      Срок хранения завершён. Создайте новую выгрузку.
    </Message>
    <div v-else-if="request?.status === 'READY'" class="space-y-2">
      <p v-if="request.expiresAt" class="text-xs text-color-secondary">
        Файл хранится до <strong class="font-semibold">{{ formatDate(request.expiresAt) }}</strong
        >.
      </p>
    </div>
    <template #footer>
      <div v-if="request?.status === 'READY'" class="flex w-full justify-center">
        <Button
          label="Скачать файл"
          size="small"
          :loading="downloadLoading"
          @click="emit('download')"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ProductExportResponseDto } from "@bartech/api-client";

const props = defineProps<{
  visible: boolean;
  creating: boolean;
  loading: boolean;
  statusError: boolean;
  request: ProductExportResponseDto | null;
  errorMessage: string;
  downloadLoading: boolean;
}>();
const emit = defineEmits<{ close: []; download: [] }>();
const isPending = computed(
  () =>
    props.creating ||
    props.loading ||
    props.request?.status === "QUEUED" ||
    props.request?.status === "PROCESSING",
);
const pendingText = computed(() =>
  props.creating || props.loading
    ? "Создаём запрос и подготавливаем файл…"
    : props.request?.status === "QUEUED"
      ? "Запрос ожидает обработки…"
      : "Формируем файл. Это может занять некоторое время…",
);

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
</script>
