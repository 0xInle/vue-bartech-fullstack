<template>
  <section v-if="operationType === 'COMPANY'" class="mt-4 rounded-lg border border-surface p-4">
    <h3 class="text-sm font-semibold">Выгрузка для закрытия</h3>
    <p class="mt-1 text-sm text-color-secondary">
      Файл будет связан только с этой операцией и будет доступен до исходного срока хранения.
    </p>
    <div class="mt-4">
      <Button
        label="Подготовить PDF-архив компании"
        size="small"
        :loading="creating"
        :disabled="creating || isProcessing || !canCreate"
        @click="createCompanyExport"
      />
    </div>
  </section>
  <Message
    v-if="errorMessage && operationType === 'COMPANY'"
    severity="error"
    size="small"
    :closable="false"
    :pt="compactMessagePt"
    class="mt-3"
  >
    {{ errorMessage }}
  </Message>
  <Message
    v-if="exportRequest"
    :severity="statusSeverity"
    size="small"
    :closable="false"
    :pt="compactMessagePt"
    class="mt-3"
  >
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span
        >{{ statusText
        }}<span v-if="exportRequest.expiresAt">
          · хранится до {{ formatDate(exportRequest.expiresAt) }}</span
        ></span
      >
      <Button
        v-if="exportRequest.status === 'READY'"
        label="Скачать файл"
        size="small"
        text
        @click="download"
      />
    </div>
  </Message>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import {
  organizationsControllerCreateClosureExport,
  organizationsControllerGetClosureOperation,
  organizationsControllerGetClosureOperationDownload,
} from "@bartech/api-client";
import type { ClosureOperationResponseDto, ProductExportResponseDto } from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { compactMessagePt } from "~/utils/primevue-message";
import { requestApi } from "~/utils/api-response";

defineOptions({ name: "ClosureExportPicker" });

const props = defineProps<{
  companyId: string;
  operationId: string;
  operationType: "VENUE" | "COMPANY";
  canCreate?: boolean;
}>();
const emit = defineEmits<{
  ready: [exportId: string];
  requested: [exportId: string];
  error: [message: string];
}>();
const identity = useIdentityFlow();
const canCreate = computed(() => props.canCreate ?? true);
const creating = ref(false);
const errorMessage = ref("");
const operationQuery = useQuery<ClosureOperationResponseDto>({
  queryKey: computed(() => ["closure-operation", props.operationId]),
  enabled: computed(() => Boolean(props.operationId)),
  retry: false,
  refetchInterval: (query) => {
    const status = query.state.data?.export?.status;
    return status === "QUEUED" || status === "PROCESSING" ? 2_000 : false;
  },
  queryFn: async ({ signal }) =>
    requestApi<ClosureOperationResponseDto>(
      organizationsControllerGetClosureOperation(
        props.operationId,
        { credentials: "include", signal },
        identity.apiFetch,
      ),
    ),
});
const exportRequest = computed(() => operationQuery.data.value?.export ?? null);
const isProcessing = computed(
  () => exportRequest.value?.status === "QUEUED" || exportRequest.value?.status === "PROCESSING",
);
const statusText = computed(() => {
  const status = exportRequest.value?.status;
  if (!status) return "";
  return {
    QUEUED: "Выгрузка ожидает обработки",
    PROCESSING: "Готовим файл",
    READY: "Файл готов",
    FAILED: "Не удалось подготовить файл. Можно запросить выгрузку повторно.",
    EXPIRED: "Срок хранения файла завершён. Можно запросить выгрузку повторно.",
  }[status];
});
const statusSeverity = computed(() =>
  exportRequest.value?.status === "FAILED" || exportRequest.value?.status === "EXPIRED"
    ? "error"
    : exportRequest.value?.status === "READY"
      ? "success"
      : "info",
);
let lastRequestedId = "";

watch(
  exportRequest,
  (request) => {
    if (request && request.id !== lastRequestedId) {
      lastRequestedId = request.id;
      emit("requested", request.id);
    }
    if (
      request?.status === "READY" &&
      request.expiresAt &&
      new Date(request.expiresAt) > new Date()
    ) {
      emit("ready", request.id);
    }
  },
  { immediate: true },
);

async function createVenueExport() {
  await createExport("VENUE_CLOSURE_PDF_ZIP");
}

async function createCompanyExport() {
  await createExport("COMPANY_CLOSURE_PDF_ZIP");
}

async function createExport(type: "VENUE_CLOSURE_PDF_ZIP" | "COMPANY_CLOSURE_PDF_ZIP") {
  creating.value = true;
  errorMessage.value = "";
  if (props.operationType === "VENUE") emit("error", "");
  try {
    const response = await requestApi<ProductExportResponseDto>(
      organizationsControllerCreateClosureExport(
        props.companyId,
        props.operationId,
        { type },
        identity.mutationOptions(),
        identity.apiFetch,
      ),
    );
    emit("requested", response.id);
    await operationQuery.refetch();
    if (response.status === "READY") emit("ready", response.id);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Не удалось запросить выгрузку.";
    if (props.operationType === "VENUE") emit("error", errorMessage.value);
  } finally {
    creating.value = false;
  }
}

async function download() {
  try {
    const result = await requestApi<{ url: string }>(
      organizationsControllerGetClosureOperationDownload(
        props.operationId,
        { credentials: "include" },
        identity.apiFetch,
      ),
    );
    window.location.assign(result.url);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "Не удалось получить ссылку на файл.";
    if (props.operationType === "VENUE") emit("error", errorMessage.value);
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

defineExpose({ createVenueExport, isCreating: creating, isProcessing });
</script>
