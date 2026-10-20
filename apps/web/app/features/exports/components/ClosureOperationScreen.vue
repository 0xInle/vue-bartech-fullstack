<template>
  <main class="min-h-screen bg-surface-50 px-4 py-8 text-color sm:px-6">
    <section class="mx-auto max-w-3xl">
      <NuxtLink to="/" class="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
        IndieBar
      </NuxtLink>
      <div v-if="identity.sessionState.value === 'loading'" class="mt-8">
        <LoadingIndicator screen />
      </div>
      <Message
        v-else-if="!identity.currentUser.value"
        severity="error"
        :closable="false"
        class="mt-8"
      >
        Войдите в аккаунт инициатора закрытия, чтобы открыть результат.
      </Message>
      <LoadingIndicator v-else-if="operationQuery.isLoading.value" screen />
      <Message
        v-else-if="operationQuery.isError.value"
        severity="error"
        :closable="false"
        class="mt-8"
      >
        Операция недоступна. Проверьте аккаунт и адрес страницы.
      </Message>
      <section v-else-if="operation" class="mt-8 rounded-xl border border-surface bg-surface-0 p-6">
        <p class="text-sm font-medium text-primary">Операция закрытия</p>
        <h1 class="text-xl mt-2 font-semibold">
          {{
            operation.type === "COMPANY"
              ? operation.originalCompanyName
              : operation.originalVenueName
          }}
        </h1>
        <p class="mt-3 text-sm text-color-secondary">
          {{ operationStatusText }}
          <span v-if="operation.closedAt"> · {{ formatDate(operation.closedAt) }}</span>
        </p>
        <Message v-if="!operation.export" severity="info" :closable="false" class="mt-5">
          Для этой операции выгрузка не запрашивалась.
        </Message>
        <Message
          v-else-if="operation.export.status === 'EXPIRED'"
          severity="warn"
          :closable="false"
          class="mt-5"
        >
          Срок хранения выгрузки завершён.
        </Message>
        <Message
          v-else-if="operation.export.status === 'FAILED'"
          severity="error"
          :closable="false"
          class="mt-5"
        >
          Не удалось сформировать выгрузку.
        </Message>
        <div
          v-else-if="operation.export.status === 'READY'"
          class="mt-5 flex flex-wrap items-center gap-3"
        >
          <Button
            label="Скачать связанную выгрузку"
            icon="pi pi-download"
            size="small"
            @click="download"
          />
          <span v-if="operation.export.expiresAt" class="text-sm text-color-secondary">
            Файл хранится до {{ formatDate(operation.export.expiresAt) }}
          </span>
        </div>
        <Message v-if="errorMessage" severity="error" :closable="false" class="mt-4">
          {{ errorMessage }}
        </Message>
      </section>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useQuery } from "@tanstack/vue-query";
import {
  organizationsControllerGetClosureOperation,
  organizationsControllerGetClosureOperationDownload,
  type ClosureOperationResponseDto,
  type ProductExportDownloadResponseDto,
} from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";

defineOptions({ name: "ClosureOperationScreen" });

const props = defineProps<{ operationId: string }>();
const identity = useIdentityFlow();
const errorMessage = ref("");
const operationQuery = useQuery<ClosureOperationResponseDto>({
  queryKey: computed(() => ["closure-result", props.operationId]),
  enabled: computed(() =>
    Boolean(props.operationId && identity.sessionState.value === "authenticated"),
  ),
  retry: false,
  refetchInterval: (query) =>
    query.state.status !== "error" &&
    (query.state.data?.status === "PREPARING" || query.state.data?.status === "PENDING_CLOSURE")
      ? 2_000
      : false,
  queryFn: async ({ signal }) =>
    requestApi<ClosureOperationResponseDto>(
      organizationsControllerGetClosureOperation(
        props.operationId,
        { credentials: "include", signal },
        identity.apiFetch,
      ),
    ),
});
const operation = computed(() => operationQuery.data.value ?? null);
const operationStatusText = computed(() => {
  if (!operation.value) return "";
  switch (operation.value.status) {
    case "PREPARING":
      return "Подготовка операции. Закрытие ещё не начато.";
    case "PENDING_CLOSURE":
      return "Закрытие компании запланировано, но ещё не завершено.";
    case "CANCELLED":
      return "Ожидающее закрытие отменено.";
    case "CLOSED":
      return operation.value.type === "COMPANY" ? "Компания закрыта." : "Заведение закрыто.";
  }
  return "";
});

onMounted(async () => {
  await identity.loadSession();
  if (identity.sessionState.value === "unauthenticated") await navigateTo("/");
});

async function download() {
  errorMessage.value = "";
  try {
    const result = await requestApi<ProductExportDownloadResponseDto>(
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
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
</script>
