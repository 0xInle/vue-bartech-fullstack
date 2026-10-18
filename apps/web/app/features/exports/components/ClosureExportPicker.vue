<template>
  <section class="mt-4 rounded-lg border border-surface p-4">
    <h3 class="font-semibold">Выгрузка для закрытия</h3>
    <p class="mt-1 text-sm text-color-secondary">
      Файл будет связан только с этой операцией и будет доступен до исходного срока хранения.
    </p>
    <div v-if="operationType === 'COMPANY'" class="mt-4">
      <Button
        label="Подготовить резервную выгрузку компании"
        icon="pi pi-database"
        size="small"
        :loading="creating"
        :disabled="creating || isProcessing || !canCreate"
        @click="create('COMPANY_CLOSURE_BACKUP_ZIP')"
      />
    </div>
    <template v-else>
      <LoadingIndicator v-if="productsQuery.isLoading.value" class="mt-4" />
      <div v-else-if="productsQuery.isSuccess.value" class="mt-4">
        <label v-if="canViewArchive" class="mb-3 flex items-center gap-2 text-sm">
          <Checkbox v-model="includeArchived" input-id="closure-include-archive" binary />
          <span>Включить архивные карточки в PDF</span>
        </label>
        <div v-if="visibleProducts.length" class="max-h-48 divide-y divide-surface overflow-auto">
          <label
            v-for="product in visibleProducts"
            :key="product.id"
            class="flex cursor-pointer items-center gap-3 py-2 text-sm"
          >
            <Checkbox
              v-model="selectedIds"
              :input-id="`closure-product-${product.id}`"
              :value="product.id"
            />
            <span class="min-w-0 flex-1 truncate">{{ product.name }}</span>
            <span class="text-xs text-color-secondary">{{ productTypeLabel(product.type) }}</span>
          </label>
        </div>
        <Message v-else severity="secondary" :closable="false" class="mt-3">
          Нет доступных техкарт для PDF-выгрузки.
        </Message>
        <div class="mt-4 flex flex-wrap gap-2">
          <Button
            label="Резервная ZIP заведения"
            icon="pi pi-database"
            severity="secondary"
            outlined
            size="small"
            :loading="creating"
            :disabled="creating || isProcessing || !canCreate || !canViewArchive"
            @click="create('VENUE_BACKUP_ZIP')"
          />
          <Button
            label="PDF выбранной карточки"
            icon="pi pi-file-pdf"
            severity="secondary"
            outlined
            size="small"
            :loading="creating"
            :disabled="creating || isProcessing || !canCreate || selectedIds.length !== 1"
            @click="create('SINGLE_PDF')"
          />
          <Button
            label="ZIP выбранных PDF"
            icon="pi pi-file-export"
            size="small"
            :loading="creating"
            :disabled="creating || isProcessing || !canCreate || !selectedIds.length"
            @click="create('BATCH_PDF_ZIP')"
          />
        </div>
      </div>
      <Message v-else severity="error" :closable="false" class="mt-4">
        Не удалось загрузить список техкарт для выгрузки.
      </Message>
    </template>
    <Message v-if="errorMessage" severity="error" :closable="false" class="mt-3">
      {{ errorMessage }}
    </Message>
    <Message v-if="exportRequest" :severity="statusSeverity" :closable="false" class="mt-3">
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
          icon="pi pi-download"
          size="small"
          text
          @click="download"
        />
      </div>
    </Message>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import {
  organizationsControllerCreateClosureExport,
  organizationsControllerGetClosureOperation,
  organizationsControllerGetClosureOperationDownload,
  productsControllerListArchive,
  productsControllerListCocktails,
  productsControllerListGarnishes,
  productsControllerListPreparations,
} from "@bartech/api-client";
import type {
  ArchiveListItemDto,
  CocktailListItemResponseDto,
  ClosureOperationResponseDto,
  ClosureExportDtoType,
  GarnishListItemResponseDto,
  PreparationListItemResponseDto,
  ProductExportResponseDto,
} from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";

defineOptions({ name: "ClosureExportPicker" });

const props = defineProps<{
  companyId: string;
  venueId?: string;
  operationId: string;
  operationType: "VENUE" | "COMPANY";
  canViewArchive?: boolean;
  canCreate?: boolean;
}>();
const emit = defineEmits<{ ready: [exportId: string]; requested: [exportId: string] }>();
const identity = useIdentityFlow();
const canCreate = computed(() => props.canCreate ?? true);
const includeArchived = ref(false);
const selectedIds = ref<string[]>([]);
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
const productsQuery = useQuery({
  queryKey: computed(() => [
    "closure-export-products",
    props.companyId,
    props.venueId,
    includeArchived.value,
  ]),
  enabled: computed(() => Boolean(props.venueId && props.operationType === "VENUE")),
  retry: false,
  queryFn: async ({ signal }): Promise<ExportProduct[]> => {
    const venueId = props.venueId!;
    const [cocktails, preparations, garnishes, archive] = await Promise.all([
      productsControllerListCocktails(
        props.companyId,
        venueId,
        undefined,
        { credentials: "include", signal },
        identity.apiFetch,
      ),
      productsControllerListPreparations(
        props.companyId,
        venueId,
        undefined,
        { credentials: "include", signal },
        identity.apiFetch,
      ),
      productsControllerListGarnishes(
        props.companyId,
        venueId,
        undefined,
        { credentials: "include", signal },
        identity.apiFetch,
      ),
      includeArchived.value && props.canViewArchive
        ? productsControllerListArchive(
            props.companyId,
            venueId,
            undefined,
            { credentials: "include", signal },
            identity.apiFetch,
          )
        : Promise.resolve({ data: [], status: 200 }),
    ]);
    const active = [
      ...(await requestApi<CocktailListItemResponseDto[]>(Promise.resolve(cocktails))).map(
        (item) => ({
          ...item,
          type: "COCKTAIL" as const,
          status: "ACTIVE" as const,
        }),
      ),
      ...(await requestApi<PreparationListItemResponseDto[]>(Promise.resolve(preparations))).map(
        (item) => ({
          ...item,
          type: "PREPARATION" as const,
          status: "ACTIVE" as const,
        }),
      ),
      ...(await requestApi<GarnishListItemResponseDto[]>(Promise.resolve(garnishes))).map(
        (item) => ({
          ...item,
          type: "GARNISH" as const,
          status: "ACTIVE" as const,
        }),
      ),
    ];
    const archived = await requestApi<ArchiveListItemDto[]>(Promise.resolve(archive));
    return [...active, ...archived.map((item) => ({ ...item, status: "ARCHIVED" as const }))];
  },
});
const visibleProducts = computed(() =>
  (productsQuery.data.value ?? []).filter(
    (product) => includeArchived.value || product.status !== "ARCHIVED",
  ),
);
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

async function create(type: ClosureExportDtoType) {
  creating.value = true;
  errorMessage.value = "";
  try {
    const response = await requestApi<ProductExportResponseDto>(
      organizationsControllerCreateClosureExport(
        props.companyId,
        props.operationId,
        {
          type,
          productIds: type === "SINGLE_PDF" ? selectedIds.value.slice(0, 1) : selectedIds.value,
          includeArchived: includeArchived.value,
        },
        identity.mutationOptions(),
        identity.apiFetch,
      ),
    );
    emit("requested", response.id);
    await operationQuery.refetch();
    if (response.status === "READY") emit("ready", response.id);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Не удалось запросить выгрузку.";
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
  }
}

function productTypeLabel(type: string) {
  return { COCKTAIL: "Коктейль", PREPARATION: "Заготовка", GARNISH: "Гарнир" }[type] ?? "Техкарта";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

type ExportProduct =
  | (CocktailListItemResponseDto & { type: "COCKTAIL"; status: "ACTIVE" })
  | (PreparationListItemResponseDto & { type: "PREPARATION"; status: "ACTIVE" })
  | (GarnishListItemResponseDto & { type: "GARNISH"; status: "ACTIVE" })
  | (ArchiveListItemDto & { status: "ARCHIVED" });
</script>
