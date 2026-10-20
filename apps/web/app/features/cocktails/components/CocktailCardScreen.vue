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
    <section class="mx-auto max-w-3xl">
      <NuxtLink :to="cocktailsPath" class="text-sm text-primary hover:underline"
        >← Коктейли</NuxtLink
      >
      <Message v-if="cocktailQuery.isError.value" severity="error" :closable="false" class="mt-5">
        Коктейль не найден или недоступен в этом заведении.
      </Message>
      <LoadingIndicator v-else-if="cocktailQuery.isLoading.value" screen />
      <article v-else-if="cocktail" class="mt-5">
        <header class="border-b border-surface pb-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {{ cocktail.type === "COCKTAIL" ? "Коктейль" : cocktail.type }} ·
                {{ cocktail.status === "ACTIVE" ? "Активен" : cocktail.status }}
              </p>
              <h1 class="text-xl mt-2 font-semibold tracking-tight">{{ cocktail.name }}</h1>
            </div>
            <Button
              v-if="canManage"
              label="Редактировать"
              icon="pi pi-pencil"
              size="small"
              severity="secondary"
              variant="outlined"
              @click="drawerVisible = true"
            />
            <ArchiveActionButton
              :company-id="companyId"
              :venue-id="venueId"
              :product-id="cocktail.id"
              product-type="COCKTAIL"
              :product-name="cocktail.name"
              :can-manage="workspace.permissions.includes('manage_product_archive')"
            />
            <ExportActionButton
              :company-id="companyId"
              :venue-id="venueId"
              :product-id="cocktail.id"
              :can-export="workspace.permissions.includes('export_data')"
            />
            <Button
              :to="historyLocation"
              as="router-link"
              label="История изменений"
              icon="pi pi-history"
              size="small"
              severity="secondary"
              variant="outlined"
            />
          </div>
          <div class="mt-3 flex flex-wrap gap-2 text-xs text-color-secondary">
            <span v-if="cocktail.glass">Бокал: {{ cocktail.glass }}</span>
            <span v-if="cocktail.ice">Лёд: {{ cocktail.ice }}</span>
            <span v-if="cocktail.preparationMethod">Метод: {{ cocktail.preparationMethod }}</span>
          </div>
        </header>

        <section class="border-b border-surface py-5">
          <h2 class="text-base font-semibold">Состав</h2>
          <ul class="mt-3 divide-y divide-surface">
            <li
              v-for="component in cocktail.components"
              :key="component.id"
              class="flex justify-between gap-4 py-2 text-sm"
            >
              <span>{{ component.name }}</span>
              <span class="whitespace-nowrap text-color-secondary"
                >{{ component.amount }} {{ component.unit }}</span
              >
            </li>
          </ul>
        </section>

        <section v-if="cocktail.garnishes.length" class="border-b border-surface py-5">
          <h2 class="text-base font-semibold">Гарниры</h2>
          <p class="mt-3 text-sm text-color-secondary">
            {{ cocktail.garnishes.map((item) => item.name).join(", ") }}
          </p>
        </section>

        <section class="border-b border-surface py-5">
          <h2 class="text-base font-semibold">Технология приготовления</h2>
          <p class="mt-3 whitespace-pre-line text-sm leading-6">{{ cocktail.technology }}</p>
        </section>

        <section v-if="cocktail.output || cocktail.comment" class="py-5">
          <p v-if="cocktail.output" class="text-sm">
            <span class="font-medium">Фактический выход:</span> {{ cocktail.output.amount }}
            {{ cocktail.output.unit }}
          </p>
          <p v-if="cocktail.comment" class="mt-3 whitespace-pre-line text-sm text-color-secondary">
            {{ cocktail.comment }}
          </p>
        </section>
      </article>
    </section>

    <CocktailFormDrawer
      v-if="cocktail"
      v-model:visible="drawerVisible"
      :company-id="companyId"
      :venue-id="venueId"
      :can-manage="canManage"
      mode="edit"
      :cocktail="cocktail"
      @updated="refreshCocktail"
    />
  </WorkspaceShell>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import { useCocktails } from "../composables/useCocktails";
import CocktailFormDrawer from "./CocktailFormDrawer.vue";
import { ArchiveActionButton } from "~/features/archive";
import ExportActionButton from "~/features/exports/components/ExportActionButton.vue";

const props = defineProps<{ cocktailId: string }>();
const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
const companyId = computed(() => workspace.value?.company.id ?? "");
const venueId = computed(() => workspace.value?.venue.id ?? "");
const { cocktailQuery: createCocktailQuery } = useCocktails(companyId, venueId);
const cocktailQuery = createCocktailQuery(() => props.cocktailId);
const cocktail = computed(() => cocktailQuery.data.value ?? null);
const drawerVisible = ref(false);
const canManage = computed(() => workspace.value?.permissions.includes("manage_products") ?? false);
const cocktailsPath = computed(
  () => `/app/companies/${companyId.value}/venues/${venueId.value}/cocktails`,
);
const historyLocation = computed(() => ({
  path: `/app/companies/${companyId.value}/venues/${venueId.value}/history`,
  query: { entityType: "PRODUCT", entityId: props.cocktailId },
}));

async function refreshCocktail(): Promise<void> {
  await cocktailQuery.refetch();
}
</script>
