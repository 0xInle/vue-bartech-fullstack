<template>
  <div v-if="loading" class="w-full pt-8">
    <LoadingIndicator screen />
  </div>
  <div v-else-if="errorMessage" class="w-full pt-8">
    <Message severity="error" :closable="false" :pt="compactMessagePt">
      {{ errorMessage }}
    </Message>
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
        <div>
          <h1 class="text-xl font-semibold tracking-tight">Коктейли</h1>
        </div>
        <Button
          v-if="canManage"
          label="Создать коктейль"
          size="small"
          @click="drawerVisible = true"
        />
      </div>

      <div class="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <FloatLabel variant="on" class="min-w-0">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText
              id="cocktail-search"
              v-model="searchText"
              size="small"
              class="w-full"
              aria-label="Поиск коктейлей по названию"
            />
          </IconField>
          <label for="cocktail-search" class="text-xs">Поиск по названию</label>
        </FloatLabel>
        <Select
          v-model="categoryId"
          :options="cocktailCategoryOptions"
          option-label="label"
          option-value="id"
          size="small"
          class="w-full"
          show-clear
          placeholder="Все категории"
          aria-label="Фильтр по категориям коктейлей"
          fluid
        />
      </div>

      <Message
        v-if="listQuery.isError.value"
        severity="error"
        :closable="false"
        :pt="compactMessagePt"
        class="mt-5"
      >
        Не удалось загрузить коктейли. Попробуйте обновить страницу.
      </Message>
      <div v-else-if="listQuery.isLoading.value" class="mt-5">
        <LoadingIndicator screen />
      </div>
      <div v-else-if="cocktails.length" class="mt-5">
        <DataTable
          :value="cocktails"
          data-key="id"
          size="small"
          row-hover
          class="cocktail-list-table hidden text-sm md:block"
          :pt="cocktailTablePt"
          @row-click="openCocktail"
        >
          <Column field="name" header="Название" :pt="cocktailColumnPt">
            <template #body="{ data }">
              <span class="font-medium">{{ data.name }}</span>
            </template>
          </Column>
          <Column
            header="Категория"
            style="width: 1%; white-space: nowrap"
            header-class="px-2"
            body-class="px-2"
            :pt="cocktailColumnPt"
          >
            <template #body="{ data }">{{ data.categories.join(", ") || "—" }}</template>
          </Column>
          <Column
            header="Статус"
            style="width: 1%; white-space: nowrap"
            header-class="px-2"
            body-class="px-2"
            :pt="cocktailColumnPt"
          >
            <template #body>
              <Tag value="Активен" severity="success" :pt="compactTagPt" />
            </template>
          </Column>
          <Column
            header="Действие"
            style="width: 1%; white-space: nowrap"
            header-class="px-2"
            body-class="px-2"
            :pt="cocktailColumnPt"
          >
            <template #body="{ data }">
              <div class="flex items-center gap-1" @click.stop>
                <Button
                  v-if="canManage"
                  v-tooltip.top="{ value: 'Редактировать', class: 'app-tooltip' }"
                  icon="pi pi-pencil"
                  size="small"
                  severity="secondary"
                  variant="text"
                  aria-label="Редактировать коктейль"
                  @click.stop="openCocktailForEdit(data.id)"
                />
                <ArchiveActionButton
                  :company-id="companyId"
                  :venue-id="venueId"
                  :product-id="data.id"
                  product-type="COCKTAIL"
                  :product-name="data.name"
                  :can-manage="canArchive"
                  icon-only
                  stay-on-page
                  @archived="listQuery.refetch()"
                />
                <span
                  v-if="canDeletePermanently"
                  v-tooltip.top="{
                    value: 'Безвозвратное удаление пока недоступно',
                    class: 'app-tooltip',
                  }"
                  class="inline-flex"
                  tabindex="0"
                  aria-label="Безвозвратное удаление пока недоступно"
                >
                  <Button
                    icon="pi pi-trash"
                    size="small"
                    severity="danger"
                    variant="text"
                    aria-label="Безвозвратное удаление пока недоступно"
                    disabled
                  />
                </span>
              </div>
            </template>
          </Column>
        </DataTable>

        <div class="grid gap-3 md:hidden">
          <article
            v-for="cocktail in cocktails"
            :key="cocktail.id"
            class="rounded-lg border border-surface bg-surface-0 p-4"
            style="border-color: var(--p-content-border-color)"
          >
            <h2 class="text-sm font-semibold">{{ cocktail.name }}</h2>
            <dl class="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
              <dt class="text-color-secondary">Категория</dt>
              <dd>{{ cocktail.categories.join(", ") || "—" }}</dd>
              <dt class="text-color-secondary">Статус</dt>
              <dd><Tag value="Активен" severity="success" :pt="compactTagPt" /></dd>
            </dl>
            <Button
              label="Открыть"
              size="small"
              severity="secondary"
              variant="text"
              class="mt-2"
              @click="openCocktail(cocktail.id)"
            />
          </article>
        </div>
      </div>
      <div v-else class="mt-5 rounded-lg border border-dashed border-surface p-6 text-center">
        <p class="text-sm text-color-secondary">
          {{
            searchText.trim() || categoryId
              ? "По этому названию коктейли не найдены."
              : "В заведении ещё нет коктейлей."
          }}
        </p>
      </div>
    </section>

    <CocktailCardDrawer
      v-if="selectedCocktailId"
      :visible="Boolean(selectedCocktailId)"
      :cocktail-id="selectedCocktailId"
      :workspace="workspace"
      @update:visible="handleCardVisibilityChange"
      @edit="openCocktailForEdit"
    />

    <CocktailFormDrawer
      v-model:visible="drawerVisible"
      :company-id="workspace.company.id"
      :venue-id="workspace.venue.id"
      :can-manage="canManage"
      mode="create"
      @created="openCreatedCocktail"
    />

    <CocktailFormDrawer
      v-if="editCocktail"
      v-model:visible="editDrawerVisible"
      :company-id="workspace.company.id"
      :venue-id="workspace.venue.id"
      :can-manage="canManage"
      mode="edit"
      :cocktail="editCocktail"
      @updated="handleCocktailUpdated"
    />
  </WorkspaceShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import CocktailFormDrawer from "./CocktailFormDrawer.vue";
import CocktailCardDrawer from "./CocktailCardDrawer.vue";
import { useCocktails } from "../composables/useCocktails";
import { compactMessagePt } from "~/utils/primevue-message";
import IconField from "primevue/iconfield";
import ArchiveActionButton from "~/features/archive/components/ArchiveActionButton.vue";

const props = defineProps<{ cocktailId?: string }>();
const route = useRoute();
const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
const companyId = computed(() => workspace.value?.company.id ?? "");
const venueId = computed(() => workspace.value?.venue.id ?? "");
const { categoryId, cocktailQuery, listQuery, referencesQuery, searchText } = useCocktails(
  companyId,
  venueId,
  { categoryFilter: true },
);
const drawerVisible = ref(false);
const editCocktailId = ref("");
const editDrawerVisible = ref(false);
const editCocktailQuery = cocktailQuery(() => editCocktailId.value);
const editCocktail = computed(() => editCocktailQuery.data.value ?? null);
const cocktails = computed(() => listQuery.data.value ?? []);
const canManage = computed(() => workspace.value?.permissions.includes("manage_products") ?? false);
const canArchive = computed(
  () => workspace.value?.permissions.includes("manage_product_archive") ?? false,
);
const canDeletePermanently = computed(
  () => workspace.value?.permissions.includes("delete_products_permanently") ?? false,
);
const selectedCocktailId = computed(() => {
  if (props.cocktailId) return props.cocktailId;
  return typeof route.query.cocktail === "string" ? route.query.cocktail : undefined;
});
const cocktailCategoryOptions = computed(() =>
  (referencesQuery.data.value?.referenceValues ?? [])
    .filter((item) => item.type === "COCKTAIL_CATEGORY")
    .sort((first, second) => first.label.localeCompare(second.label, "ru")),
);
const cocktailTablePt = {
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
const cocktailColumnPt = {
  bodyCell: { style: { paddingBlock: "0" } },
};
const compactTagPt = {
  root: { style: { fontSize: "0.75rem", padding: "0.125rem 0.375rem" } },
  label: { style: { fontWeight: "400" } },
};

function cocktailPath(cocktailId: string) {
  return {
    path: `/app/companies/${companyId.value}/venues/${venueId.value}/cocktails`,
    query: { ...route.query, cocktail: cocktailId },
  };
}

async function handleCardVisibilityChange(visible: boolean): Promise<void> {
  if (visible) return;
  const query = { ...route.query };
  delete query.cocktail;
  await navigateTo({
    path: `/app/companies/${companyId.value}/venues/${venueId.value}/cocktails`,
    query,
  });
}

async function openCreatedCocktail(cocktailId: string): Promise<void> {
  await navigateTo(cocktailPath(cocktailId));
}

function openCocktail(value: string | { data: { id: string } }): void {
  const cocktailId = typeof value === "string" ? value : value.data.id;
  void navigateTo(cocktailPath(cocktailId));
}

async function openCocktailForEdit(cocktailId: string): Promise<void> {
  if (selectedCocktailId.value) await handleCardVisibilityChange(false);
  editCocktailId.value = cocktailId;
  editDrawerVisible.value = true;
}

function handleCocktailUpdated(): void {
  void listQuery.refetch();
  editCocktailId.value = "";
}

watch(editDrawerVisible, (visible) => {
  if (!visible) editCocktailId.value = "";
});

watch(editCocktail, (cocktail) => {
  if (cocktail && editCocktailId.value) editDrawerVisible.value = true;
});
</script>

<style scoped>
:deep(.cocktail-list-table .p-datatable-tbody > tr:last-child > td) {
  border-block-end-width: 0;
}
</style>
