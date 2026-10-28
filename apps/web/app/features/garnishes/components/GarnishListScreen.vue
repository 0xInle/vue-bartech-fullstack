<template>
  <div v-if="loading" class="mx-auto max-w-5xl pt-8">
    <LoadingIndicator screen />
  </div>
  <div v-else-if="errorMessage" class="mx-auto max-w-5xl pt-8">
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
    <section class="mx-auto max-w-5xl">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold tracking-tight">Гарниры</h1>
        </div>
        <Button
          v-if="canManage"
          label="Создать гарнир"
          size="small"
          @click="drawerVisible = true"
        />
      </div>
      <div class="mt-5 max-w-md">
        <FloatLabel variant="on">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText
              id="garnish-search"
              v-model="searchText"
              size="small"
              class="w-full"
              aria-label="Поиск гарниров по названию"
            />
          </IconField>
          <label for="garnish-search" class="text-xs">Поиск по названию</label>
        </FloatLabel>
      </div>
      <Message
        v-if="listQuery.isError.value"
        severity="error"
        :closable="false"
        :pt="compactMessagePt"
        class="mt-5"
      >
        Не удалось загрузить гарниры. Попробуйте обновить страницу.
      </Message>
      <LoadingIndicator v-else-if="listQuery.isLoading.value" screen />
      <div v-else-if="garnishes.length" class="mt-5 grid gap-3 sm:gap-0">
        <NuxtLink
          v-for="garnish in garnishes"
          :key="garnish.id"
          :to="garnishLocation(garnish.id)"
          class="block rounded-lg border border-surface bg-surface-0 p-4 transition-colors hover:border-primary-200 hover:bg-primary-50 sm:rounded-none sm:border-x-0 sm:border-t-0 sm:bg-transparent sm:px-3 sm:py-3 sm:hover:border-surface sm:hover:bg-primary-50 sm:last:border-b-0"
          @click="rememberScroll"
        >
          <div
            class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] sm:items-baseline sm:gap-4"
          >
            <p class="font-medium sm:text-sm">{{ garnish.name }}</p>
            <p class="text-sm text-color-secondary">
              {{ garnish.componentSummary || "Состав будет указан в техкарте" }}
            </p>
            <time :datetime="garnish.updatedAt" class="text-xs text-color-secondary">{{
              formatDate(garnish.updatedAt)
            }}</time>
          </div>
        </NuxtLink>
      </div>
      <div v-else class="mt-5 rounded-lg border border-dashed border-surface p-6 text-center">
        <p class="text-sm text-color-secondary">
          {{
            hasFilters
              ? "По заданным условиям гарниры не найдены."
              : "В заведении ещё нет гарниров."
          }}
        </p>
      </div>
    </section>
    <GarnishFormDrawer
      v-if="canManage"
      v-model:visible="drawerVisible"
      :company-id="workspace.company.id"
      :venue-id="workspace.venue.id"
      :can-manage="canManage"
      mode="create"
      @created="openCreatedGarnish"
    />
  </WorkspaceShell>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import GarnishFormDrawer from "./GarnishFormDrawer.vue";
import { useGarnishes } from "../composables/useGarnishes";
import { compactMessagePt } from "~/utils/primevue-message";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";

const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
const companyId = computed(() => workspace.value?.company.id ?? "");
const venueId = computed(() => workspace.value?.venue.id ?? "");
const { listQuery, rememberScroll, restoreScroll, searchText } = useGarnishes(companyId, venueId);
const drawerVisible = ref(false);
const garnishes = computed(() => listQuery.data.value ?? []);
const canManage = computed(() => workspace.value?.permissions.includes("manage_products") ?? false);
const hasFilters = computed(() => Boolean(searchText.value.trim()));
const restoredContext = ref("");
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
function garnishLocation(id: string) {
  return {
    path: `/app/companies/${companyId.value}/venues/${venueId.value}/garnishes/${id}`,
    query: {
      query: searchText.value.trim() || undefined,
    },
  };
}
async function openCreatedGarnish(id: string): Promise<void> {
  await navigateTo(garnishLocation(id));
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
</script>
