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
          <h1 class="mt-1 text-2xl font-semibold tracking-tight">Коктейли</h1>
        </div>
        <Button
          v-if="canManage"
          label="Создать коктейль"
          icon="pi pi-plus"
          size="small"
          @click="drawerVisible = true"
        />
      </div>

      <div class="mt-5 max-w-md">
        <InputText v-model="searchText" size="small" placeholder="Поиск по названию" fluid />
      </div>

      <Message v-if="listQuery.isError.value" severity="error" :closable="false" class="mt-5">
        Не удалось загрузить коктейли. Попробуйте обновить страницу.
      </Message>
      <div v-else-if="listQuery.isLoading.value" class="mt-5">
        <LoadingIndicator screen />
      </div>
      <div v-else-if="cocktails.length" class="mt-5 grid gap-3">
        <NuxtLink
          v-for="cocktail in cocktails"
          :key="cocktail.id"
          :to="cocktailPath(cocktail.id)"
          class="block rounded-lg border border-surface bg-surface-0 p-4 transition-colors hover:border-primary-200 hover:bg-primary-50"
        >
          <div
            class="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
          >
            <p class="font-medium">{{ cocktail.name }}</p>
            <time class="text-xs text-color-secondary">{{ formatDate(cocktail.updatedAt) }}</time>
          </div>
          <p class="mt-2 text-sm text-color-secondary">
            {{ cocktail.componentSummary || "Состав будет указан в техкарте" }}
          </p>
        </NuxtLink>
      </div>
      <div v-else class="mt-5 rounded-lg border border-dashed border-surface p-6 text-center">
        <p class="text-sm text-color-secondary">
          {{
            searchText.trim()
              ? "По этому названию коктейли не найдены."
              : "В заведении ещё нет коктейлей."
          }}
        </p>
        <Button
          v-if="canManage && !searchText.trim()"
          label="Создать первый коктейль"
          size="small"
          class="mt-3"
          @click="drawerVisible = true"
        />
      </div>
    </section>

    <CocktailFormDrawer
      v-model:visible="drawerVisible"
      :company-id="workspace.company.id"
      :venue-id="workspace.venue.id"
      :can-manage="canManage"
      mode="create"
      @created="openCreatedCocktail"
    />
  </WorkspaceShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import CocktailFormDrawer from "./CocktailFormDrawer.vue";
import { useCocktails } from "../composables/useCocktails";

const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
const companyId = computed(() => workspace.value?.company.id ?? "");
const venueId = computed(() => workspace.value?.venue.id ?? "");
const { listQuery, searchText } = useCocktails(companyId, venueId);
const drawerVisible = ref(false);
const cocktails = computed(() => listQuery.data.value ?? []);
const canManage = computed(() => workspace.value?.permissions.includes("manage_products") ?? false);

function cocktailPath(cocktailId: string): string {
  return `/app/companies/${companyId.value}/venues/${venueId.value}/cocktails/${cocktailId}`;
}

async function openCreatedCocktail(cocktailId: string): Promise<void> {
  await navigateTo(cocktailPath(cocktailId));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
</script>
