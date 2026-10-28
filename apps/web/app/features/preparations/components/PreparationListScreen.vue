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
          <h1 class="text-xl font-semibold tracking-tight">Заготовки</h1>
        </div>
        <Button
          v-if="canManage"
          label="Создать заготовку"
          size="small"
          @click="drawerVisible = true"
        />
      </div>
      <div class="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <FloatLabel variant="on" class="min-w-0">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText
              id="preparation-search"
              v-model="searchText"
              size="small"
              class="w-full"
              aria-label="Поиск заготовок по названию"
            />
          </IconField>
          <label for="preparation-search" class="text-xs">Поиск по названию</label>
        </FloatLabel>
        <FloatLabel variant="on" class="min-w-0">
          <Select
            v-model="categoryCode"
            input-id="preparation-category"
            :options="referencesQuery.data.value?.preparationCategories ?? []"
            option-label="name"
            option-value="code"
            size="small"
            show-clear
            fluid
          />
          <label for="preparation-category" class="text-xs">Категория</label>
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
      <LoadingIndicator v-else-if="listQuery.isLoading.value" screen />
      <div v-else-if="preparations.length" class="mt-5 grid gap-3">
        <NuxtLink
          v-for="preparation in preparations"
          :key="preparation.id"
          :to="preparationPath(preparation.id)"
          class="block rounded-lg border border-surface bg-surface-0 p-4 transition-colors hover:border-primary-200 hover:bg-primary-50 sm:rounded-none sm:border-x-0 sm:border-t-0 sm:bg-transparent sm:px-3 sm:py-3 sm:hover:border-surface sm:hover:bg-primary-50 sm:last:border-b-0"
          @click="rememberScroll"
          ><div
            class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] sm:items-baseline sm:gap-4"
          >
            <div>
              <p class="font-medium sm:text-sm">{{ preparation.name }}</p>
              <p class="mt-1 text-xs text-color-secondary">{{ preparation.categoryName }}</p>
            </div>
            <p class="mt-2 text-sm text-color-secondary sm:mt-0">
              {{ preparation.componentSummary || "Состав будет указан в техкарте" }}
            </p>
            <time class="text-xs text-color-secondary">{{
              formatDate(preparation.updatedAt)
            }}</time>
          </div></NuxtLink
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
import { compactMessagePt } from "~/utils/primevue-message";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
const companyId = computed(() => workspace.value?.company.id ?? "");
const venueId = computed(() => workspace.value?.venue.id ?? "");
const { categoryCode, listQuery, referencesQuery, rememberScroll, restoreScroll, searchText } =
  usePreparations(companyId, venueId);
const drawerVisible = ref(false);
const preparations = computed(() => listQuery.data.value ?? []);
const canManage = computed(() => workspace.value?.permissions.includes("manage_products") ?? false);
const hasFilters = computed(() => Boolean(searchText.value.trim() || categoryCode.value));
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
