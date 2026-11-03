<template>
  <div v-if="loading" class="w-full pt-8"><LoadingIndicator screen /></div>
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
      <div class="flex flex-wrap items-start justify-between gap-3">
        <h1 class="text-xl font-semibold tracking-tight">Гарниры</h1>
        <div class="flex flex-wrap gap-2">
          <Button
            v-if="canManage"
            label="Создать гарнир"
            size="small"
            @click="drawerVisible = true"
          />
        </div>
      </div>
      <div class="mt-5 grid gap-3 pt-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <FloatLabel variant="on" class="min-w-0"
          ><IconField
            ><InputIcon class="pi pi-search" /><InputText
              id="garnish-search"
              v-model="searchText"
              size="small"
              class="w-full"
              aria-label="Поиск гарниров по названию" /></IconField
          ><label for="garnish-search" class="text-xs">Поиск по названию</label></FloatLabel
        >
        <FloatLabel variant="on" class="min-w-0">
          <Select
            :model-value="workflowStatus === 'ALL' ? null : workflowStatus"
            input-id="garnish-workflow-status-filter"
            :options="workflowStatusOptions"
            option-label="label"
            option-value="value"
            size="small"
            class="w-full"
            show-clear
            fluid
            aria-label="Фильтр по статусу гарниров"
            @update:model-value="setWorkflowStatus"
          />
          <label for="garnish-workflow-status-filter" class="text-xs">Статус</label>
        </FloatLabel>
      </div>
      <Message
        v-if="listQuery.isError.value"
        severity="error"
        :closable="false"
        :pt="compactMessagePt"
        class="mt-5"
        >Не удалось загрузить гарниры. Попробуйте обновить страницу.</Message
      >
      <div v-else-if="listQuery.isLoading.value" class="mt-5"><LoadingIndicator screen /></div>
      <div v-else-if="garnishes.length" class="mt-5">
        <DataTable
          :value="garnishes"
          data-key="id"
          size="small"
          row-hover
          class="product-list-table hidden text-sm md:block"
          :pt="tablePt"
          @row-click="openGarnish"
        >
          <Column field="name" header="Название" :pt="columnPt"
            ><template #body="{ data }"
              ><span class="font-medium">{{ data.name }}</span></template
            ></Column
          >
          <Column
            header="Статус"
            style="width: 1%; white-space: nowrap"
            header-class="px-2"
            body-class="px-2"
            :pt="columnPt"
            ><template #body="{ data }"
              ><Tag
                :value="data.workflowStatus === 'IN_DEVELOPMENT' ? 'Проработка' : 'Активен'"
                :severity="data.workflowStatus === 'IN_DEVELOPMENT' ? 'warn' : 'success'"
                :pt="compactTagPt" /></template
          ></Column>
          <Column
            header=""
            style="width: 30px; min-width: 30px; max-width: 30px"
            header-class="!p-0"
            body-class="!p-0"
          />
          <Column
            header="Действие"
            style="width: 1%; white-space: nowrap"
            header-class="px-2"
            body-class="px-2"
            :pt="columnPt"
            ><template #body="{ data }"
              ><div class="flex items-center gap-1" @click.stop>
                <Button
                  v-if="canManage"
                  v-tooltip.top="{ value: 'Редактировать', class: 'app-tooltip' }"
                  icon="pi pi-pencil"
                  size="small"
                  severity="secondary"
                  variant="text"
                  aria-label="Редактировать гарнир"
                  @click="openGarnishForEdit(data.id)"
                /><ArchiveActionButton
                  :company-id="companyId"
                  :venue-id="venueId"
                  :product-id="data.id"
                  product-type="GARNISH"
                  :product-name="data.name"
                  :can-manage="canArchive"
                  icon-only
                  stay-on-page
                  @archived="listQuery.refetch()"
                /><PermanentDeleteActionButton
                  :company-id="companyId"
                  :venue-id="venueId"
                  :product-id="data.id"
                  :product-name="data.name"
                  product-type="GARNISH"
                  :can-manage="canDeletePermanently"
                  @deleted="handlePermanentDelete"
                /></div></template
          ></Column>
        </DataTable>
        <div class="grid gap-3 md:hidden">
          <article
            v-for="item in garnishes"
            :key="item.id"
            class="rounded-lg border border-surface bg-surface-0 p-4"
            style="border-color: var(--p-content-border-color)"
          >
            <button class="w-full text-left" @click="openGarnish(item.id)">
              <h2 class="text-sm font-semibold">{{ item.name }}</h2>
              <div class="mt-3 flex items-center gap-2 text-sm">
                <span class="text-color-secondary">Статус</span>
                <Tag
                  :value="item.workflowStatus === 'IN_DEVELOPMENT' ? 'Проработка' : 'Активен'"
                  :severity="item.workflowStatus === 'IN_DEVELOPMENT' ? 'warn' : 'success'"
                  :pt="compactTagPt"
                />
              </div>
            </button>
            <div class="mt-2 flex gap-1">
              <Button
                v-if="canManage"
                label="Редактировать"
                size="small"
                severity="secondary"
                variant="text"
                @click="openGarnishForEdit(item.id)"
              /><ArchiveActionButton
                :company-id="companyId"
                :venue-id="venueId"
                :product-id="item.id"
                product-type="GARNISH"
                :product-name="item.name"
                :can-manage="canArchive"
                stay-on-page
                @archived="listQuery.refetch()"
              /><PermanentDeleteActionButton
                :company-id="companyId"
                :venue-id="venueId"
                :product-id="item.id"
                :product-name="item.name"
                product-type="GARNISH"
                :can-manage="canDeletePermanently"
                @deleted="handlePermanentDelete"
              />
            </div>
          </article>
        </div>
      </div>
      <div
        v-else
        class="mt-5 rounded-lg border border-dashed border-surface p-6 text-center"
        style="border-color: var(--p-content-border-color)"
      >
        <p class="text-xs text-color-secondary">
          {{
            hasFilters
              ? "По заданным условиям гарниры не найдены."
              : "Список гарниров пуст. Вы можете их создать."
          }}
        </p>
      </div>
    </section>
    <GarnishCardDrawer
      v-if="selectedGarnishId && !editGarnishId"
      :visible="Boolean(selectedGarnishId)"
      :garnish-id="selectedGarnishId"
      :workspace="workspace"
      @update:visible="handleCardVisibilityChange"
      @edit="openGarnishForEdit"
    />
    <GarnishFormDrawer
      v-model:visible="drawerVisible"
      :company-id="companyId"
      :venue-id="venueId"
      :can-manage="canManage"
      mode="create"
      @created="handleGarnishCreated"
    />
    <GarnishFormDrawer
      v-if="editGarnish"
      v-model:visible="editDrawerVisible"
      :company-id="companyId"
      :venue-id="venueId"
      :can-manage="canManage"
      mode="edit"
      :garnish="editGarnish"
      @updated="handleGarnishUpdated"
    />
  </WorkspaceShell>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRoute } from "vue-router";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import { ArchiveActionButton, PermanentDeleteActionButton } from "~/features/archive";
import GarnishFormDrawer from "./GarnishFormDrawer.vue";
import GarnishCardDrawer from "./GarnishCardDrawer.vue";
import { useGarnishes } from "../composables/useGarnishes";
import { compactMessagePt } from "~/utils/primevue-message";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";

const props = defineProps<{ garnishId?: string }>();
const route = useRoute();
const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
const companyId = computed(() => workspace.value?.company.id ?? "");
const venueId = computed(() => workspace.value?.venue.id ?? "");
const {
  listQuery,
  rememberScroll,
  restoreScroll,
  searchText,
  workflowStatus,
  setWorkflowStatus,
  garnishQuery: createGarnishQuery,
} = useGarnishes(companyId, venueId);
const drawerVisible = ref(false);
const canManage = computed(() => workspace.value?.permissions.includes("manage_products") ?? false);
const requestedEditGarnishId = computed(() =>
  typeof route.query.editGarnish === "string" ? route.query.editGarnish : "",
);
const editGarnishId = computed(() => (canManage.value ? requestedEditGarnishId.value : ""));
const editDrawerVisible = computed({
  get: () => Boolean(editGarnishId.value),
  set: (visible) => {
    if (!visible) void closeEditDrawer();
  },
});
const editQuery = createGarnishQuery(() => editGarnishId.value);
const editGarnish = computed(() => editQuery.data.value ?? null);
const garnishes = computed(() => listQuery.data.value ?? []);
const canArchive = computed(
  () => workspace.value?.permissions.includes("manage_product_archive") ?? false,
);
const canDeletePermanently = computed(
  () => workspace.value?.permissions.includes("delete_products_permanently") ?? false,
);
const selectedGarnishId = computed(
  () =>
    props.garnishId ?? (typeof route.query.garnish === "string" ? route.query.garnish : undefined),
);
const hasFilters = computed(() =>
  Boolean(searchText.value.trim() || workflowStatus.value !== "ALL"),
);
const workflowStatusOptions = [
  { label: "Активен", value: "ACTIVE" },
  { label: "Проработка", value: "IN_DEVELOPMENT" },
];
const compactTagPt = {
  root: { style: { fontSize: "0.75rem", padding: "0.125rem 0.375rem" } },
  label: { style: { fontWeight: "400" } },
};
const restoredContext = ref("");
watch(
  [loading, canManage, requestedEditGarnishId],
  ([isLoading, allowed, requestedId]) => {
    if (!isLoading && requestedId && !allowed) void closeEditDrawer();
  },
  { immediate: true },
);
watch(
  () =>
    listQuery.isSuccess.value && !loading.value && Boolean(workspace.value && currentUser.value),
  async (ready) => {
    const context = `${companyId.value}:${venueId.value}`;
    if (!ready || restoredContext.value === context) return;
    restoredContext.value = context;
    await nextTick();
    restoreScroll();
  },
  { immediate: true },
);
const tablePt = {
  root: {
    style: {
      "--p-datatable-border-color": "var(--p-content-border-color)",
      "--p-datatable-header-cell-background": "transparent",
      "--p-datatable-row-background": "transparent",
      "--p-datatable-row-hover-background":
        "color-mix(in srgb, var(--p-primary-100) 70%, var(--p-content-background))",
      border: "1px solid var(--p-datatable-border-color)",
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
const columnPt = { bodyCell: { style: { paddingBlock: "0" } } };
const listPath = computed(
  () => `/app/companies/${companyId.value}/venues/${venueId.value}/garnishes`,
);
function garnishLocation(id: string) {
  return { path: listPath.value, query: { ...route.query, garnish: id } };
}
function openGarnish(value: string | { data: { id: string } }): void {
  const id = typeof value === "string" ? value : value.data.id;
  rememberScroll();
  void navigateTo(garnishLocation(id));
}
async function handleCardVisibilityChange(visible: boolean): Promise<void> {
  if (visible) return;
  if (props.garnishId) {
    const query = { ...route.query };
    delete query.garnish;
    await navigateTo({ path: listPath.value, query });
    return;
  }
  const query = { ...route.query };
  delete query.garnish;
  await navigateTo({ path: listPath.value, query });
}
async function handlePermanentDelete(productId: string): Promise<void> {
  if (selectedGarnishId.value === productId) await handleCardVisibilityChange(false);
  await listQuery.refetch();
}
function handleGarnishCreated(): void {
  void listQuery.refetch();
}
async function openGarnishForEdit(id: string): Promise<void> {
  if (!canManage.value) return;
  const query = { ...route.query, editGarnish: id };
  if (props.garnishId) query.garnish = id;
  await navigateTo({ path: listPath.value, query });
}
function handleGarnishUpdated(): void {
  void listQuery.refetch();
}
async function closeEditDrawer(): Promise<void> {
  const query = { ...route.query };
  delete query.editGarnish;
  if (props.garnishId) query.garnish = props.garnishId;
  await navigateTo({ path: listPath.value, query });
}
</script>

<style scoped>
:deep(.product-list-table .p-datatable-tbody > tr:last-child > td) {
  border-block-end-width: 0;
}
</style>
