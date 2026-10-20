<template>
  <div v-if="loading" class="mx-auto max-w-5xl pt-8">
    <LoadingIndicator screen />
  </div>
  <div v-else-if="errorMessage" class="mx-auto max-w-5xl pt-8">
    <Message severity="error" :closable="false">{{ errorMessage }}</Message>
  </div>
  <WorkspaceShell
    v-else-if="workspace && currentUser"
    :workspace="workspace"
    :workplaces="workplaces"
    :full-name="currentUser.fullName"
    @switch="switchWorkspace"
  >
    <section class="mx-auto max-w-5xl">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Продукция</p>
          <h1 class="text-xl mt-1 font-semibold tracking-tight">Заготовки</h1>
        </div>
        <Button
          v-if="canManage"
          label="Создать заготовку"
          icon="pi pi-plus"
          size="small"
          @click="drawerVisible = true"
        />
      </div>
      <div class="mt-5 grid gap-3 sm:grid-cols-3">
        <InputText v-model="searchText" size="small" placeholder="Поиск по названию" fluid /><Select
          v-model="categoryCode"
          :options="referencesQuery.data.value?.preparationCategories ?? []"
          option-label="name"
          option-value="code"
          placeholder="Все категории"
          size="small"
          show-clear
          fluid
        /><Select
          v-model="sort"
          :options="sortOptions"
          option-label="label"
          option-value="value"
          size="small"
          fluid
        />
      </div>
      <Message v-if="listQuery.isError.value" severity="error" :closable="false" class="mt-5"
        >Не удалось загрузить заготовки. Попробуйте обновить страницу.</Message
      >
      <LoadingIndicator v-else-if="listQuery.isLoading.value" screen />
      <div v-else-if="preparations.length" class="mt-5 grid gap-3">
        <NuxtLink
          v-for="preparation in preparations"
          :key="preparation.id"
          :to="preparationPath(preparation.id)"
          class="block rounded-lg border border-surface bg-surface-0 p-4 transition-colors hover:border-primary-200 hover:bg-primary-50"
          @click="rememberScroll"
          ><div
            class="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
          >
            <div>
              <p class="font-medium">{{ preparation.name }}</p>
              <p class="mt-1 text-xs text-color-secondary">{{ preparation.categoryName }}</p>
            </div>
            <time class="text-xs text-color-secondary">{{
              formatDate(preparation.updatedAt)
            }}</time>
          </div>
          <p class="mt-2 text-sm text-color-secondary">
            {{ preparation.componentSummary || "Состав будет указан в техкарте" }}
          </p></NuxtLink
        >
      </div>
      <div v-else class="mt-5 rounded-lg border border-dashed border-surface p-6 text-center">
        <p class="text-sm text-color-secondary">
          {{
            hasFilters
              ? "По заданным условиям заготовки не найдены."
              : "В заведении ещё нет заготовок."
          }}
        </p>
        <Button
          v-if="canManage && !hasFilters"
          label="Создать первую заготовку"
          size="small"
          class="mt-3"
          @click="drawerVisible = true"
        />
      </div>
    </section>
    <PreparationFormDrawer
      v-model:visible="drawerVisible"
      :company-id="workspace.company.id"
      :venue-id="workspace.venue.id"
      :can-manage="canManage"
      mode="create"
      @created="openCreatedPreparation"
    />
  </WorkspaceShell>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import PreparationFormDrawer from "./PreparationFormDrawer.vue";
import { usePreparations } from "../composables/usePreparations";
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
  sort,
} = usePreparations(companyId, venueId);
const drawerVisible = ref(false);
const preparations = computed(() => listQuery.data.value ?? []);
const canManage = computed(() => workspace.value?.permissions.includes("manage_products") ?? false);
const hasFilters = computed(() =>
  Boolean(searchText.value.trim() || categoryCode.value || sort.value !== "name"),
);
const sortOptions = [
  { label: "По названию", value: "name" },
  { label: "Сначала изменённые", value: "updated" },
];
const restoredScroll = ref(false);

watch(
  () => listQuery.isSuccess.value,
  async (isSuccess) => {
    if (!isSuccess || restoredScroll.value) return;
    restoredScroll.value = true;
    await nextTick();
    restoreScroll();
  },
  { immediate: true },
);

function preparationPath(id: string): string {
  return `/app/companies/${companyId.value}/venues/${venueId.value}/preparations/${id}`;
}
async function openCreatedPreparation(id: string): Promise<void> {
  await navigateTo(preparationPath(id));
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
</script>
