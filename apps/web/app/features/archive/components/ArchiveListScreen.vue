<template>
  <div v-if="loading" class="w-full pt-8">
    <LoadingIndicator screen />
  </div>
  <div v-else-if="errorMessage" class="w-full pt-8">
    <Message severity="error" :closable="false" :pt="compactMessagePt">{{ errorMessage }}</Message>
  </div>
  <WorkspaceShell
    v-else-if="workspace && currentUser"
    :workspace="workspace"
    :workplaces="workplaces"
    :full-name="currentUser.fullName"
    @switch="switchWorkspace"
  >
    <section class="w-full">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold tracking-tight">Архив</h1>
      </div>
      <div class="mt-5 grid gap-3 pt-2 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <FloatLabel variant="on" class="min-w-0">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText
              id="archive-search"
              v-model="query"
              size="small"
              class="w-full"
              maxlength="160"
              aria-label="Поиск в архиве по названию"
            />
          </IconField>
          <label for="archive-search" class="text-xs">Поиск по названию</label>
        </FloatLabel>
        <FloatLabel variant="on" class="min-w-0">
          <Select
            v-model="type"
            input-id="archive-type-filter"
            :options="typeOptions"
            option-label="label"
            option-value="value"
            size="small"
            class="w-full"
            show-clear
            fluid
            aria-label="Фильтр по типу продукции"
          />
          <label for="archive-type-filter" class="text-xs">Тип продукции</label>
        </FloatLabel>
      </div>
      <Message
        v-if="listQuery.isError.value"
        severity="error"
        :closable="false"
        :pt="compactMessagePt"
        class="mt-5"
      >
        Не удалось загрузить архив. Попробуйте обновить страницу.
      </Message>
      <div v-else-if="listQuery.isLoading.value" class="mt-5">
        <LoadingIndicator screen />
      </div>
      <template v-else-if="archiveItems.length">
        <DataTable
          :value="pageItems"
          data-key="id"
          size="small"
          row-hover
          class="product-list-table mt-5 hidden text-sm md:block"
          :pt="archiveTablePt"
          @row-click="openArchiveProduct"
        >
          <Column field="name" header="Название" :pt="archiveColumnPt">
            <template #body="{ data }">
              <span class="font-medium">{{ data.name }}</span>
            </template>
          </Column>
          <Column
            field="type"
            header="Тип продукции"
            style="width: 1%; white-space: nowrap"
            header-class="px-2"
            body-class="px-2"
            :pt="archiveColumnPt"
          >
            <template #body="{ data }">
              <Tag :value="productTypeLabels[data.type]" severity="secondary" :pt="compactTagPt" />
            </template>
          </Column>
          <Column
            v-if="canManageArchive || canDeletePermanently"
            header=""
            style="width: 30px; min-width: 30px; max-width: 30px"
            header-class="!p-0"
            body-class="!p-0"
          />
          <Column
            v-if="canManageArchive || canDeletePermanently"
            header="Действие"
            style="width: 1%; white-space: nowrap"
            header-class="px-2"
            body-class="px-2"
            :pt="archiveColumnPt"
          >
            <template #body="{ data }">
              <ArchiveListActions
                :company-id="companyId"
                :venue-id="venueId"
                :product="data"
                :can-manage-archive="canManageArchive"
                :can-delete-permanently="canDeletePermanently"
                @restored="handleProductRestored"
                @deleted="handleProductDeletedFromList"
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
            <button class="w-full text-left" @click="openArchiveProduct(product.id)">
              <h2 class="text-sm font-semibold">{{ product.name }}</h2>
              <div class="mt-3 flex items-center gap-2 text-sm">
                <span class="text-color-secondary">Тип продукции</span>
                <Tag
                  :value="productTypeLabels[product.type]"
                  severity="secondary"
                  :pt="compactTagPt"
                />
              </div>
            </button>
            <div v-if="canManageArchive || canDeletePermanently" class="mt-2 flex gap-1">
              <ArchiveListActions
                :company-id="companyId"
                :venue-id="venueId"
                :product="product"
                :can-manage-archive="canManageArchive"
                :can-delete-permanently="canDeletePermanently"
                @restored="handleProductRestored"
                @deleted="handleProductDeletedFromList"
              />
            </div>
          </article>
        </div>
        <Paginator
          v-if="archiveItems.length > pageSize"
          :first="first"
          :rows="pageSize"
          :total-records="archiveItems.length"
          :rows-per-page-options="[10, 20, 30]"
          :pt="paginatorPt"
          class="mt-3"
          @page="handlePageChange"
        />
      </template>
      <p v-else class="mt-6 text-sm text-color-secondary">
        {{
          query || type
            ? "По выбранным условиям ничего не найдено."
            : "В архиве пока нет продукции."
        }}
      </p>
    </section>
    <ArchiveProductDrawer
      v-if="selectedProductId && workspace"
      :visible="true"
      :product-id="selectedProductId"
      :workspace="workspace"
      show-actions
      @update:visible="handleCardVisibilityChange"
      @deleted="handleProductDeleted"
    />
  </WorkspaceShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { DataTableRowClickEvent } from "primevue/datatable";
import type { LocationQueryRaw } from "vue-router";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import { useProductArchive, type ArchiveItem } from "../composables/useProductArchive";
import ArchiveProductDrawer from "./ArchiveProductDrawer.vue";
import ArchiveListActions from "./ArchiveListActions.vue";
import { productTypeLabels } from "../product-links";
import { compactMessagePt } from "~/utils/primevue-message";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";

const props = defineProps<{ selectedProductId?: string }>();
const pageSize = ref(20);
const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
const companyId = computed(() => workspace.value?.company.id ?? "");
const venueId = computed(() => workspace.value?.venue.id ?? "");
const basePath = computed(() => `/app/companies/${companyId.value}/venues/${venueId.value}`);
const listPath = computed(() => `${basePath.value}/archive`);
const route = useRoute();
const router = useRouter();
const typeOptions = Object.entries(productTypeLabels)
  .filter(([value]) => value !== "INGREDIENT")
  .map(([value, label]) => ({ value, label }));

function updateQuery(query: LocationQueryRaw): void {
  void router.replace({ query: { ...route.query, ...query } });
}

const query = computed({
  get: () => (typeof route.query.query === "string" ? route.query.query : ""),
  set: (value: string) => updateQuery({ query: value || undefined, page: undefined }),
});
const type = computed({
  get: () =>
    typeOptions.some((item) => item.value === route.query.type)
      ? (route.query.type as ArchiveItem["type"])
      : undefined,
  set: (value: ArchiveItem["type"] | null | undefined) =>
    updateQuery({ type: value || undefined, page: undefined }),
});
const { list } = useProductArchive(companyId, venueId);
const listQuery = list(query, type);
const archiveItems = computed(() => listQuery.data.value ?? []);
const canManageArchive = computed(
  () => workspace.value?.permissions.includes("manage_product_archive") ?? false,
);
const canDeletePermanently = computed(
  () => workspace.value?.permissions.includes("delete_products_permanently") ?? false,
);
const totalPages = computed(() =>
  Math.max(1, Math.ceil(archiveItems.value.length / pageSize.value)),
);
const currentPage = computed(() => {
  const parsed = Number.parseInt(String(route.query.page ?? "1"), 10);
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : 1, 1), totalPages.value);
});
const first = computed(() => (currentPage.value - 1) * pageSize.value);
const pageItems = computed(() =>
  archiveItems.value.slice(first.value, first.value + pageSize.value),
);
const selectedProductId = computed(() => props.selectedProductId);
const compactTagPt = {
  root: { style: { fontSize: "0.75rem", padding: "0.125rem 0.375rem" } },
  label: { style: { fontWeight: "400" } },
};
const archiveTablePt = {
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
  bodyRow: { class: "cursor-pointer" },
};
const archiveColumnPt = { bodyCell: { style: { paddingBlock: "0" } } };
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
watch(archiveItems, (items) => {
  if (items.length <= pageSize.value) {
    if (route.query.page) updateQuery({ page: undefined });
    return;
  }
  if (currentPage.value !== Number.parseInt(String(route.query.page ?? "1"), 10))
    updateQuery({ page: String(currentPage.value) });
});

function archiveLocation(productId: string) {
  return { path: `${listPath.value}/${productId}`, query: { ...route.query } };
}

function openArchiveProduct(event: string | DataTableRowClickEvent): void {
  const productId = typeof event === "string" ? event : (event.data as ArchiveItem).id;
  void navigateTo(archiveLocation(productId));
}

function handlePageChange(event: { page: number; rows: number }): void {
  pageSize.value = event.rows;
  updateQuery({ page: String(event.page + 1) });
}

async function handleCardVisibilityChange(visible: boolean): Promise<void> {
  if (visible) return;
  await navigateTo({ path: listPath.value, query: { ...route.query } });
}

async function handleProductDeleted(): Promise<void> {
  await listQuery.refetch();
  await handleCardVisibilityChange(false);
}

async function handleProductRestored(): Promise<void> {
  await listQuery.refetch();
}

async function handleProductDeletedFromList(): Promise<void> {
  await listQuery.refetch();
}
</script>

<style scoped>
:deep(.product-list-table .p-datatable-tbody > tr:last-child > td) {
  border-block-end-width: 0;
}
</style>
