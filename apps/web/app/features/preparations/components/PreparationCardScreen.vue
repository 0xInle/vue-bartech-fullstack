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
    ><section class="mx-auto max-w-3xl">
      <NuxtLink :to="preparationsPath" class="text-sm text-primary hover:underline"
        >← Заготовки</NuxtLink
      ><Message
        v-if="preparationQuery.isError.value"
        severity="error"
        :closable="false"
        class="mt-5"
        >Заготовка не найдена или недоступна в этом заведении.</Message
      ><LoadingIndicator v-else-if="preparationQuery.isLoading.value" screen />
      <article v-else-if="preparation" class="mt-5">
        <header class="border-b border-surface pb-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Заготовка · Активна
              </p>
              <h1 class="text-xl mt-2 font-semibold tracking-tight">{{ preparation.name }}</h1>
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
              :product-id="preparation.id"
              product-type="PREPARATION"
              :product-name="preparation.name"
              :can-manage="workspace.permissions.includes('manage_product_archive')"
            />
            <ExportActionButton
              :company-id="companyId"
              :venue-id="venueId"
              :product-id="preparation.id"
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
          <p class="mt-3 text-sm text-color-secondary">{{ preparation.categoryName }}</p>
        </header>
        <section class="border-b border-surface py-5">
          <h2 class="text-base font-semibold">Состав</h2>
          <ul class="mt-3 divide-y divide-surface">
            <li
              v-for="component in preparation.components"
              :key="component.id"
              class="flex justify-between gap-4 py-2 text-sm"
            >
              <NuxtLink
                v-if="component.productType === 'PREPARATION'"
                :to="preparationPath(component.productId)"
                class="text-primary hover:underline"
                >{{ component.name }}</NuxtLink
              ><span v-else>{{ component.name }}</span
              ><span class="whitespace-nowrap text-color-secondary"
                >{{ component.amount }} {{ component.unit }}</span
              >
            </li>
          </ul>
        </section>
        <section class="border-b border-surface py-5">
          <h2 class="text-base font-semibold">Технология приготовления</h2>
          <p class="mt-3 whitespace-pre-line text-sm leading-6">{{ preparation.technology }}</p>
        </section>
        <section v-if="preparation.output || preparation.comment" class="py-5">
          <p v-if="preparation.output" class="text-sm">
            <span class="font-medium">Фактический выход:</span> {{ preparation.output.amount }}
            {{ preparation.output.unit }}
          </p>
          <p
            v-if="preparation.comment"
            class="mt-3 whitespace-pre-line text-sm text-color-secondary"
          >
            {{ preparation.comment }}
          </p>
        </section>
      </article>
    </section>
    <PreparationFormDrawer
      v-if="preparation"
      v-model:visible="drawerVisible"
      :company-id="companyId"
      :venue-id="venueId"
      :can-manage="canManage"
      mode="edit"
      :preparation="preparation"
      @updated="refreshPreparation"
    />
  </WorkspaceShell>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import { ArchiveActionButton } from "~/features/archive";
import ExportActionButton from "~/features/exports/components/ExportActionButton.vue";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import { usePreparations } from "../composables/usePreparations";
import PreparationFormDrawer from "./PreparationFormDrawer.vue";
const props = defineProps<{ preparationId: string }>();
const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
const companyId = computed(() => workspace.value?.company.id ?? "");
const venueId = computed(() => workspace.value?.venue.id ?? "");
const { preparationQuery: createPreparationQuery } = usePreparations(companyId, venueId);
const preparationQuery = createPreparationQuery(() => props.preparationId);
const preparation = computed(() => preparationQuery.data.value ?? null);
const drawerVisible = ref(false);
const canManage = computed(() => workspace.value?.permissions.includes("manage_products") ?? false);
const preparationsPath = computed(
  () => `/app/companies/${companyId.value}/venues/${venueId.value}/preparations`,
);
const historyLocation = computed(() => ({
  path: `/app/companies/${companyId.value}/venues/${venueId.value}/history`,
  query: { entityType: "PRODUCT", entityId: props.preparationId },
}));
function preparationPath(id: string): string {
  return `${preparationsPath.value}/${id}`;
}
async function refreshPreparation(): Promise<void> {
  await preparationQuery.refetch();
}
</script>
