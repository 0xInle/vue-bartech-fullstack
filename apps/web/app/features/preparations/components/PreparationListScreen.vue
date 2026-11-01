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
        <h1 class="text-xl font-semibold tracking-tight">Заготовки</h1>
        <Button
          v-if="canManage"
          label="Создать заготовку"
          size="small"
          @click="drawerVisible = true"
        />
      </div>
      <div class="mt-5 grid gap-3 pt-2 sm:grid-cols-[minmax(0,1fr)_14rem_12rem]">
        <FloatLabel variant="on" class="min-w-0"
          ><IconField
            ><InputIcon class="pi pi-search" /><InputText
              id="preparation-search"
              v-model="searchText"
              size="small"
              class="w-full"
              aria-label="Поиск заготовок по названию" /></IconField
          ><label for="preparation-search" class="text-xs">Поиск по названию</label></FloatLabel
        >
        <FloatLabel variant="on" class="min-w-0"
          ><Select
            v-model="categoryCode"
            input-id="preparation-category"
            :options="preparationCategoryOptions"
            option-label="name"
            option-value="code"
            size="small"
            class="w-full"
            show-clear
            fluid
            aria-label="Фильтр по категориям заготовок"
          /><label for="preparation-category" class="text-xs">Категория</label></FloatLabel
        >
        <FloatLabel variant="on" class="min-w-0">
          <Select
            :model-value="workflowStatus === 'ALL' ? null : workflowStatus"
            input-id="preparation-workflow-status-filter"
            :options="workflowStatusOptions"
            option-label="label"
            option-value="value"
            size="small"
            class="w-full"
            show-clear
            fluid
            aria-label="Фильтр по статусу заготовок"
            @update:model-value="setWorkflowStatus"
          />
          <label for="preparation-workflow-status-filter" class="text-xs">Статус</label>
        </FloatLabel>
      </div>
      <Message
        v-if="listQuery.isError.value"
        severity="error"
        :closable="false"
        :pt="compactMessagePt"
        class="mt-5"
        >Не удалось загрузить заготовки. Попробуйте обновить страницу.</Message
      >
      <div v-else-if="listQuery.isLoading.value" class="mt-5"><LoadingIndicator screen /></div>
      <div v-else-if="preparations.length" class="mt-5">
        <DataTable
          :value="preparations"
          data-key="id"
          size="small"
          row-hover
          class="product-list-table hidden text-sm md:block"
          :pt="tablePt"
          @row-click="openPreparation"
        >
          <Column field="name" header="Название" :pt="columnPt"
            ><template #body="{ data }"
              ><span class="font-medium">{{ data.name }}</span></template
            ></Column
          >
          <Column
            header="Категория"
            style="width: 1%; white-space: nowrap"
            header-class="px-2"
            body-class="px-2"
            :pt="columnPt"
            ><template #body="{ data }">{{ data.categoryName }}</template></Column
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
                  aria-label="Редактировать заготовку"
                  @click="openPreparationForEdit(data.id)"
                /><ArchiveActionButton
                  :company-id="companyId"
                  :venue-id="venueId"
                  :product-id="data.id"
                  product-type="PREPARATION"
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
                  product-type="PREPARATION"
                  :can-manage="canDeletePermanently"
                  @deleted="handlePermanentDelete"
                /></div></template
          ></Column>
        </DataTable>
        <div class="grid gap-3 md:hidden">
          <article
            v-for="item in preparations"
            :key="item.id"
            class="rounded-lg border border-surface bg-surface-0 p-4"
            style="border-color: var(--p-content-border-color)"
          >
            <button class="w-full text-left" @click="openPreparation(item.id)">
              <h2 class="text-sm font-semibold">{{ item.name }}</h2>
              <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                <dt class="text-color-secondary">Категория</dt>
                <dd>{{ item.categoryName }}</dd>
                <dt class="text-color-secondary">Статус</dt>
                <dd>
                  <Tag
                    :value="item.workflowStatus === 'IN_DEVELOPMENT' ? 'Проработка' : 'Активен'"
                    :severity="item.workflowStatus === 'IN_DEVELOPMENT' ? 'warn' : 'success'"
                    :pt="compactTagPt"
                  />
                </dd>
              </dl>
            </button>
            <div class="mt-2 flex gap-1">
              <Button
                v-if="canManage"
                label="Редактировать"
                size="small"
                severity="secondary"
                variant="text"
                @click="openPreparationForEdit(item.id)"
              /><ArchiveActionButton
                :company-id="companyId"
                :venue-id="venueId"
                :product-id="item.id"
                product-type="PREPARATION"
                :product-name="item.name"
                :can-manage="canArchive"
                stay-on-page
                @archived="listQuery.refetch()"
              /><PermanentDeleteActionButton
                :company-id="companyId"
                :venue-id="venueId"
                :product-id="item.id"
                :product-name="item.name"
                product-type="PREPARATION"
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
              ? "По заданным условиям заготовки не найдены."
              : "Список заготовок пуст. Вы можете их создать."
          }}
        </p>
      </div>
    </section>
    <PreparationCardDrawer
      v-if="selectedPreparationId && !editPreparationId"
      :visible="Boolean(selectedPreparationId)"
      :preparation-id="selectedPreparationId"
      :workspace="workspace"
      @update:visible="handleCardVisibilityChange"
      @edit="openPreparationForEdit"
    />
    <PreparationFormDrawer
      v-model:visible="drawerVisible"
      :company-id="companyId"
      :venue-id="venueId"
      :can-manage="canManage"
      mode="create"
      @created="handlePreparationCreated"
    />
    <PreparationFormDrawer
      v-if="editPreparation"
      v-model:visible="editDrawerVisible"
      :company-id="companyId"
      :venue-id="venueId"
      :can-manage="canManage"
      mode="edit"
      :preparation="editPreparation"
      @updated="handlePreparationUpdated"
    />
  </WorkspaceShell>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRoute } from "vue-router";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import { ArchiveActionButton, PermanentDeleteActionButton } from "~/features/archive";
import PreparationFormDrawer from "./PreparationFormDrawer.vue";
import PreparationCardDrawer from "./PreparationCardDrawer.vue";
import { usePreparations } from "../composables/usePreparations";
import { compactMessagePt } from "~/utils/primevue-message";
import { compareCategoryNames } from "~/utils/category-order";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";

const props = defineProps<{ preparationId?: string }>();
const route = useRoute();
const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
const companyId = computed(() => workspace.value?.company.id ?? "");
const venueId = computed(() => workspace.value?.venue.id ?? "");
const {
  categoryCode,
  listQuery,
  referencesQuery,
  rememberScroll,
  restoreScroll,
  searchText,
  workflowStatus,
  setWorkflowStatus,
  preparationQuery: createPreparationQuery,
} = usePreparations(companyId, venueId);
const drawerVisible = ref(false);
const canManage = computed(() => workspace.value?.permissions.includes("manage_products") ?? false);
const requestedEditPreparationId = computed(() =>
  typeof route.query.editPreparation === "string" ? route.query.editPreparation : "",
);
const editPreparationId = computed(() => (canManage.value ? requestedEditPreparationId.value : ""));
const editDrawerVisible = computed({
  get: () => Boolean(editPreparationId.value),
  set: (visible) => {
    if (!visible) void closeEditDrawer();
  },
});
const editQuery = createPreparationQuery(() => editPreparationId.value);
const editPreparation = computed(() => editQuery.data.value ?? null);
const preparations = computed(() => listQuery.data.value ?? []);
const canArchive = computed(
  () => workspace.value?.permissions.includes("manage_product_archive") ?? false,
);
const canDeletePermanently = computed(
  () => workspace.value?.permissions.includes("delete_products_permanently") ?? false,
);
const selectedPreparationId = computed(
  () =>
    props.preparationId ??
    (typeof route.query.preparation === "string" ? route.query.preparation : undefined),
);
const hasFilters = computed(() =>
  Boolean(searchText.value.trim() || categoryCode.value || workflowStatus.value !== "ALL"),
);
const workflowStatusOptions = [
  { label: "Активен", value: "ACTIVE" },
  { label: "Проработка", value: "IN_DEVELOPMENT" },
];
const preparationCategoryOptions = computed(() =>
  [...(referencesQuery.data.value?.preparationCategories ?? [])].sort((first, second) =>
    compareCategoryNames(first.name, second.name),
  ),
);
const compactTagPt = {
  root: { style: { fontSize: "0.75rem", padding: "0.125rem 0.375rem" } },
  label: { style: { fontWeight: "400" } },
};
const restoredScroll = ref(false);
watch(
  [loading, canManage, requestedEditPreparationId],
  ([isLoading, allowed, requestedId]) => {
    if (!isLoading && requestedId && !allowed) void closeEditDrawer();
  },
  { immediate: true },
);
watch(
  () => listQuery.isSuccess.value,
  async (success) => {
    if (!success || restoredScroll.value) return;
    restoredScroll.value = true;
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
  () => `/app/companies/${companyId.value}/venues/${venueId.value}/preparations`,
);
function preparationLocation(id: string) {
  return { path: listPath.value, query: { ...route.query, preparation: id } };
}
function openPreparation(value: string | { data: { id: string } }): void {
  const id = typeof value === "string" ? value : value.data.id;
  rememberScroll();
  void navigateTo(preparationLocation(id));
}
async function handleCardVisibilityChange(visible: boolean): Promise<void> {
  if (visible) return;
  if (props.preparationId) {
    const query = { ...route.query };
    delete query.preparation;
    await navigateTo({ path: listPath.value, query });
    return;
  }
  const query = { ...route.query };
  delete query.preparation;
  await navigateTo({ path: listPath.value, query });
}
async function handlePermanentDelete(productId: string): Promise<void> {
  if (selectedPreparationId.value === productId) await handleCardVisibilityChange(false);
  await listQuery.refetch();
}
function handlePreparationCreated(): void {
  void listQuery.refetch();
}
async function openPreparationForEdit(id: string): Promise<void> {
  if (!canManage.value) return;
  const query = { ...route.query, editPreparation: id };
  if (props.preparationId) query.preparation = id;
  await navigateTo({ path: listPath.value, query });
}
function handlePreparationUpdated(): void {
  void listQuery.refetch();
}
async function closeEditDrawer(): Promise<void> {
  const query = { ...route.query };
  delete query.editPreparation;
  if (props.preparationId) query.preparation = props.preparationId;
  await navigateTo({ path: listPath.value, query });
}
</script>

<style scoped>
:deep(.product-list-table .p-datatable-tbody > tr:last-child > td) {
  border-block-end-width: 0;
}
</style>
