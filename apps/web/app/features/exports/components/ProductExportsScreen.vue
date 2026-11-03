<template>
  <section class="w-full">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold tracking-tight">Выгрузка</h1>
      <div v-if="!exportId" class="flex flex-wrap items-center gap-2">
        <Button
          label="Выгрузить"
          size="small"
          :disabled="!filteredProducts.length || isExportPending"
          :loading="creating"
          @click="createBatch"
        />
      </div>
    </header>

    <template v-if="!exportId">
      <div
        class="export-filters mt-5 flex flex-col gap-3 pt-2 md:flex-row md:flex-nowrap md:items-end"
      >
        <FloatLabel variant="on" class="min-w-0 flex-1">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText
              id="export-search"
              v-model="query"
              size="small"
              class="w-full"
              maxlength="160"
              aria-label="Поиск по названию продукции"
            />
          </IconField>
          <label for="export-search" class="text-xs">Поиск по названию</label>
        </FloatLabel>
        <FloatLabel variant="on" class="w-full min-w-0 md:w-56 md:flex-none">
          <MultiSelect
            v-model="types"
            input-id="export-type-filter"
            :options="typeOptions"
            option-label="label"
            option-value="value"
            size="small"
            class="w-full"
            show-clear
            :show-toggle-all="false"
            fluid
            :max-selected-labels="1"
            selected-items-label="{0} выбрано"
            aria-label="Фильтр по категории продукции"
          />
          <label for="export-type-filter" class="text-xs">Категория</label>
        </FloatLabel>
        <FloatLabel variant="on" class="w-full min-w-0 md:w-56 md:flex-none">
          <MultiSelect
            v-model="statuses"
            input-id="export-status-filter"
            :options="statusOptions"
            option-label="label"
            option-value="value"
            size="small"
            class="w-full"
            show-clear
            :show-toggle-all="false"
            fluid
            :max-selected-labels="1"
            selected-items-label="{0} выбрано"
            aria-label="Фильтр по статусу продукции"
          />
          <label for="export-status-filter" class="text-xs">Статус продукции</label>
        </FloatLabel>
      </div>

      <Message
        v-if="!canViewArchive"
        severity="info"
        :closable="false"
        :pt="compactMessagePt"
        class="mt-5"
      >
        Архивные карточки не отображаются: у вас нет доступа к архиву.
      </Message>
      <Message
        v-if="productsQuery.isError.value"
        severity="error"
        :closable="false"
        :pt="compactMessagePt"
        class="mt-5"
      >
        Не удалось загрузить продукцию. Проверьте доступ и повторите попытку.
        <Button label="Повторить" size="small" text @click="productsQuery.refetch()" />
      </Message>
      <div v-else-if="productsQuery.isLoading.value" class="mt-5">
        <LoadingIndicator screen />
      </div>
      <template v-else-if="filteredProducts.length">
        <DataTable
          :value="pageItems"
          data-key="id"
          size="small"
          row-hover
          class="product-list-table mt-5 hidden text-sm md:block"
          :pt="exportTablePt"
        >
          <Column field="name" header="Название">
            <template #body="{ data }">
              <span class="font-medium">{{ data.name }}</span>
            </template>
          </Column>
          <Column field="type" header="Категория" style="width: 1%; white-space: nowrap">
            <template #body="{ data }">
              <Tag :value="productTypeLabel(data.type)" severity="secondary" :pt="compactTagPt" />
            </template>
          </Column>
          <Column
            header=""
            style="width: 30px; min-width: 30px; max-width: 30px"
            header-class="!p-0"
            body-class="!p-0"
          />
          <Column field="status" header="Статус" style="width: 1%; white-space: nowrap">
            <template #body="{ data }">
              <Tag
                :value="productStatusLabel(data)"
                :severity="productStatusSeverity(data)"
                :pt="compactTagPt"
              />
            </template>
          </Column>
        </DataTable>
        <div class="mt-5 grid gap-3 md:hidden">
          <article
            v-for="product in pageItems"
            :key="product.id"
            class="rounded-lg border border-surface bg-surface-0 p-4"
            style="border-color: var(--p-content-border-color)"
          >
            <div class="min-w-0 flex-1">
              <h2 class="text-sm font-semibold">{{ product.name }}</h2>
              <div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span class="text-color-secondary">Категория</span>
                <Tag
                  :value="productTypeLabel(product.type)"
                  severity="secondary"
                  :pt="compactTagPt"
                />
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span class="text-color-secondary">Статус</span>
                <Tag
                  :value="productStatusLabel(product)"
                  :severity="productStatusSeverity(product)"
                  :pt="compactTagPt"
                />
              </div>
            </div>
          </article>
        </div>
        <Paginator
          v-if="filteredProducts.length > pageSize"
          :first="first"
          :rows="pageSize"
          :total-records="filteredProducts.length"
          :rows-per-page-options="[10, 20, 30]"
          :pt="paginatorPt"
          class="mt-3"
          @page="handlePageChange"
        />
      </template>
      <p v-else class="mt-6 text-sm text-color-secondary">
        {{
          query || types.length || statuses.length
            ? "По выбранным условиям ничего не найдено."
            : "В заведении пока нет продукции для выгрузки."
        }}
      </p>
    </template>
    <ProductExportProgressDialog
      :visible="exportDialogVisible"
      :creating="creating"
      :loading="exports.statusQuery.isLoading.value"
      :status-error="exports.statusQuery.isError.value"
      :request="request"
      :error-message="exportDialogError"
      :download-loading="downloading"
      @close="closeExportDialog"
      @download="download"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import type { LocationQueryRaw } from "vue-router";
import {
  productsControllerListArchive,
  productsControllerListCocktails,
  productsControllerListGarnishes,
  productsControllerListPreparations,
} from "@bartech/api-client";
import type {
  ArchiveListItemDto,
  CocktailListItemResponseDto,
  GarnishListItemResponseDto,
  PreparationListItemResponseDto,
} from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { useProductExports } from "../composables/useProductExports";
import { requestApi } from "~/utils/api-response";
import { compactMessagePt } from "~/utils/primevue-message";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import ProductExportProgressDialog from "./ProductExportProgressDialog.vue";

const props = defineProps<{
  companyId: string;
  venueId: string;
  exportId?: string;
  permissions: string[];
}>();
const identity = useIdentityFlow();
const route = useRoute();
const router = useRouter();
const pageSize = ref(20);
const creating = ref(false);
const downloading = ref(false);
const exportDialogVisible = ref(Boolean(props.exportId));
const exportDialogError = ref("");
const currentExportId = ref(props.exportId ?? "");
const canViewArchive = computed(() => props.permissions.includes("view_archive"));
const company = computed(() => props.companyId);
const venue = computed(() => props.venueId);
const exports = useProductExports(company, venue, currentExportId);
const typeOptions = [
  { label: "Коктейли", value: "COCKTAIL" },
  { label: "Заготовки", value: "PREPARATION" },
  { label: "Гарниры", value: "GARNISH" },
] as const;
const statusOptions = computed<{ label: string; value: ExportProductStatus }[]>(() => [
  { label: "Активен", value: "ACTIVE" },
  { label: "Проработка", value: "IN_DEVELOPMENT" },
  ...(canViewArchive.value ? [{ label: "В архиве", value: "ARCHIVED" }] : []),
]);
const compactTagPt = {
  root: { style: { fontSize: "0.75rem", padding: "0.125rem 0.375rem" } },
  label: { style: { fontWeight: "400" } },
};
const exportTablePt = {
  root: {
    style: {
      "--p-datatable-border-color": "var(--p-content-border-color)",
      "--p-datatable-header-cell-background": "transparent",
      "--p-datatable-row-background": "transparent",
      "--p-datatable-row-hover-background":
        "color-mix(in srgb, var(--p-primary-100) 70%, var(--p-content-background))",
      border: "1px solid var(--p-content-border-color)",
      borderRadius: "var(--p-content-border-radius)",
    },
  },
  headerCell: {
    class: "whitespace-nowrap px-1 py-1 text-sm",
    style: {
      borderTop: "0",
      borderRight: "0",
      borderLeft: "0",
      borderBottom: "1px solid var(--p-content-border-color)",
      fontWeight: "400",
    },
  },
  bodyCell: {
    class: "px-1 py-1 text-sm",
    style: {
      borderTop: "0",
      borderRight: "0",
      borderLeft: "0",
      borderBottom: "1px solid var(--p-content-border-color)",
    },
  },
};
const paginatorPt = {
  root: { class: "gap-1 border-0 bg-transparent p-0 text-sm" },
  first: { class: "!h-8 !min-w-8 text-xs" },
  prev: { class: "!h-8 !min-w-8 text-xs" },
  page: { class: "!h-8 !min-w-8 text-xs" },
  next: { class: "!h-8 !min-w-8 text-xs" },
  last: { class: "!h-8 !min-w-8 text-xs" },
  pcRowPerPageDropdown: {
    root: { class: "!h-8" },
    label: { class: "!text-xs" },
  },
};
function updateQuery(nextQuery: LocationQueryRaw): void {
  void router.replace({ query: { ...route.query, ...nextQuery } });
}

function queryValues(value: string | null | (string | null)[] | undefined): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.filter((item): item is string => typeof item === "string");
}

const query = computed({
  get: () => (typeof route.query.query === "string" ? route.query.query : ""),
  set: (value: string) => updateQuery({ query: value || undefined, page: undefined }),
});
const types = computed<ProductType[]>({
  get: () =>
    queryValues(route.query.type).filter((value): value is ProductType =>
      typeOptions.some((item) => item.value === value),
    ),
  set: (value) => updateQuery({ type: value.length ? value : undefined, page: undefined }),
});
const statuses = computed<ExportProductStatus[]>({
  get: () =>
    queryValues(route.query.status).filter((value): value is ExportProductStatus =>
      statusOptions.value.some((item) => item.value === value),
    ),
  set: (value) => updateQuery({ status: value.length ? value : undefined, page: undefined }),
});

const productsQuery = useQuery({
  queryKey: computed(() => [
    "product-export-options",
    props.companyId,
    props.venueId,
    canViewArchive.value,
  ]),
  enabled: computed(() => Boolean(props.companyId && props.venueId && !props.exportId)),
  retry: false,
  queryFn: async ({ signal }): Promise<ExportProduct[]> => {
    const [cocktails, preparations, garnishes, archive] = await Promise.all([
      productsControllerListCocktails(
        props.companyId,
        props.venueId,
        undefined,
        { credentials: "include", signal },
        identity.apiFetch,
      ),
      productsControllerListPreparations(
        props.companyId,
        props.venueId,
        undefined,
        { credentials: "include", signal },
        identity.apiFetch,
      ),
      productsControllerListGarnishes(
        props.companyId,
        props.venueId,
        undefined,
        { credentials: "include", signal },
        identity.apiFetch,
      ),
      canViewArchive.value
        ? productsControllerListArchive(
            props.companyId,
            props.venueId,
            undefined,
            { credentials: "include", signal },
            identity.apiFetch,
          )
        : Promise.resolve({ data: [], status: 200 }),
    ]);
    const activeProducts: ExportProduct[] = [
      ...(await requestApi<CocktailListItemResponseDto[]>(Promise.resolve(cocktails))).map(
        (item) => ({ ...item, type: "COCKTAIL" as const, storageStatus: "ACTIVE" as const }),
      ),
      ...(await requestApi<PreparationListItemResponseDto[]>(Promise.resolve(preparations))).map(
        (item) => ({ ...item, type: "PREPARATION" as const, storageStatus: "ACTIVE" as const }),
      ),
      ...(await requestApi<GarnishListItemResponseDto[]>(Promise.resolve(garnishes))).map(
        (item) => ({
          ...item,
          type: "GARNISH" as const,
          storageStatus: "ACTIVE" as const,
        }),
      ),
    ];
    const archived = await requestApi<ArchiveListItemDto[]>(Promise.resolve(archive));
    return [
      ...activeProducts,
      ...archived.map((item) => ({ ...item, storageStatus: "ARCHIVED" as const })),
    ];
  },
});
const products = computed(() => productsQuery.data.value ?? []);
const filteredProducts = computed(() =>
  products.value.filter((product) => {
    const matchesQuery = product.name
      .toLocaleLowerCase("ru-RU")
      .includes(query.value.trim().toLocaleLowerCase("ru-RU"));
    const matchesType = !types.value.length || types.value.includes(product.type);
    const matchesStatus = !statuses.value.length || statuses.value.includes(productStatus(product));
    return matchesQuery && matchesType && matchesStatus;
  }),
);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredProducts.value.length / pageSize.value)),
);
const currentPage = computed(() => {
  const parsed = Number.parseInt(String(route.query.page ?? "1"), 10);
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : 1, 1), totalPages.value);
});
const first = computed(() => (currentPage.value - 1) * pageSize.value);
const pageItems = computed(() =>
  filteredProducts.value.slice(first.value, first.value + pageSize.value),
);
const request = computed(() => {
  const data = exports.statusQuery.data.value;
  return data?.id === currentExportId.value ? data : null;
});
const isExportPending = computed(
  () =>
    creating.value || request.value?.status === "QUEUED" || request.value?.status === "PROCESSING",
);

watch(
  () => props.exportId,
  (id) => {
    if (id) {
      currentExportId.value = id;
      exportDialogVisible.value = true;
    }
  },
);

watch(filteredProducts, (items) => {
  if (items.length <= pageSize.value) {
    if (route.query.page) updateQuery({ page: undefined });
    return;
  }
  if (currentPage.value !== Number.parseInt(String(route.query.page ?? "1"), 10))
    updateQuery({ page: String(currentPage.value) });
});

function handlePageChange(event: { page: number; rows: number }): void {
  pageSize.value = event.rows;
  updateQuery({ page: String(event.page + 1) });
}

async function createBatch(): Promise<void> {
  exportDialogError.value = "";
  currentExportId.value = "";
  exportDialogVisible.value = true;
  creating.value = true;
  try {
    currentExportId.value = await exports.createBatch({
      productIds: filteredProducts.value.map((product) => product.id),
      includeArchived: filteredProducts.value.some(
        (product) => product.storageStatus === "ARCHIVED",
      ),
    });
  } catch (error) {
    exportDialogError.value =
      error instanceof Error ? error.message : "Не удалось создать запрос выгрузки.";
  } finally {
    creating.value = false;
  }
}

async function download(): Promise<void> {
  downloading.value = true;
  exportDialogError.value = "";
  try {
    await exports.download();
  } catch (error) {
    exportDialogError.value =
      error instanceof Error ? error.message : "Не удалось получить ссылку на файл.";
  } finally {
    downloading.value = false;
  }
}

function closeExportDialog(): void {
  if (isExportPending.value) return;
  exportDialogVisible.value = false;
  exportDialogError.value = "";
  currentExportId.value = "";
  if (props.exportId) {
    void navigateTo(`/app/companies/${props.companyId}/venues/${props.venueId}/exports`);
  }
}

function productStatus(product: ExportProduct): ExportProductStatus {
  if (product.storageStatus === "ARCHIVED") return "ARCHIVED";
  return "workflowStatus" in product && product.workflowStatus === "IN_DEVELOPMENT"
    ? "IN_DEVELOPMENT"
    : "ACTIVE";
}

function productStatusLabel(product: ExportProduct): string {
  return {
    ACTIVE: "Активен",
    IN_DEVELOPMENT: "Проработка",
    ARCHIVED: "В архиве",
  }[productStatus(product)];
}

function productStatusSeverity(product: ExportProduct): "success" | "warn" | "secondary" {
  return {
    ACTIVE: "success",
    IN_DEVELOPMENT: "warn",
    ARCHIVED: "secondary",
  }[productStatus(product)];
}

function productTypeLabel(productType: ProductType): string {
  return (
    {
      COCKTAIL: "Коктейли",
      PREPARATION: "Заготовки",
      GARNISH: "Гарниры",
      INGREDIENT: "Ингредиенты",
    }[productType] ?? "Техкарта"
  );
}

type ProductType = ArchiveListItemDto["type"];
type ExportProductStatus = "ACTIVE" | "IN_DEVELOPMENT" | "ARCHIVED";
type ActiveExportProduct =
  | (CocktailListItemResponseDto & { type: "COCKTAIL"; storageStatus: "ACTIVE" })
  | (PreparationListItemResponseDto & { type: "PREPARATION"; storageStatus: "ACTIVE" })
  | (GarnishListItemResponseDto & { type: "GARNISH"; storageStatus: "ACTIVE" });
type ExportProduct = ActiveExportProduct | (ArchiveListItemDto & { storageStatus: "ARCHIVED" });
</script>

<style scoped>
@media (min-width: 48rem) {
  .export-filters {
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: flex-end;
  }
}

:deep(.product-list-table .p-datatable-tbody > tr:last-child > td) {
  border-block-end-width: 0;
}
</style>
