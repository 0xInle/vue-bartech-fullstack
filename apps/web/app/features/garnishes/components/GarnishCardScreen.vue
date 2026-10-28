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
    <section class="mx-auto max-w-3xl">
      <NuxtLink :to="listLocation" class="text-sm text-primary hover:underline">← Гарниры</NuxtLink>
      <Message
        v-if="garnishQuery.isError.value"
        severity="error"
        :closable="false"
        :pt="compactMessagePt"
        class="mt-5"
      >
        Гарнир не найден или недоступен в этом заведении.
      </Message>
      <LoadingIndicator v-else-if="garnishQuery.isLoading.value" screen />
      <article v-else-if="garnish" class="mt-5">
        <header class="pb-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Гарнир · Активен
              </p>
              <h1 class="text-xl mt-2 font-semibold tracking-tight">{{ garnish.name }}</h1>
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
          </div>
          <ArchiveActionButton
            :company-id="companyId"
            :venue-id="venueId"
            :product-id="garnish.id"
            product-type="GARNISH"
            :product-name="garnish.name"
            :can-manage="workspace.permissions.includes('manage_product_archive')"
          />
          <ExportActionButton
            :company-id="companyId"
            :venue-id="venueId"
            :product-id="garnish.id"
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
            class="mt-3"
          />
        </header>
        <Divider class="!my-0" />
        <section class="py-5">
          <h2 class="text-base font-semibold">Состав</h2>
          <ul class="mt-3 divide-y divide-surface">
            <li
              v-for="component in garnish.components"
              :key="component.id"
              class="flex justify-between gap-4 py-2 text-sm"
            >
              <NuxtLink
                v-if="component.productType === 'PREPARATION'"
                :to="preparationPath(component.productId)"
                class="text-primary hover:underline"
                >{{ component.name }}</NuxtLink
              >
              <span v-else>{{ component.name }}</span>
              <span class="whitespace-nowrap text-color-secondary"
                >{{ component.amount }} {{ component.unit }}</span
              >
            </li>
          </ul>
        </section>
        <Divider class="!my-0" />
        <section class="py-5">
          <h2 class="text-base font-semibold">Технология приготовления</h2>
          <p class="mt-3 whitespace-pre-line text-sm leading-6">{{ garnish.technology }}</p>
        </section>
        <Divider v-if="garnish.output || garnish.comment" class="!my-0" />
        <section v-if="garnish.output || garnish.comment" class="py-5">
          <p v-if="garnish.output" class="text-sm">
            <span class="font-medium">Фактический выход:</span> {{ garnish.output.amount }}
            {{ garnish.output.unit }}
          </p>
          <p v-if="garnish.comment" class="mt-3 whitespace-pre-line text-sm text-color-secondary">
            {{ garnish.comment }}
          </p>
        </section>
      </article>
    </section>
    <GarnishFormDrawer
      v-if="garnish && canManage"
      v-model:visible="drawerVisible"
      :company-id="companyId"
      :venue-id="venueId"
      :can-manage="canManage"
      mode="edit"
      :garnish="garnish"
      @updated="refreshGarnish"
    />
  </WorkspaceShell>
</template>
<script setup lang="ts">
import { computed, ref } from "vue";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import { ArchiveActionButton } from "~/features/archive";
import ExportActionButton from "~/features/exports/components/ExportActionButton.vue";
import { compactMessagePt } from "~/utils/primevue-message";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import { useGarnishes } from "../composables/useGarnishes";
import GarnishFormDrawer from "./GarnishFormDrawer.vue";
const props = defineProps<{ garnishId: string }>();
const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
const companyId = computed(() => workspace.value?.company.id ?? "");
const venueId = computed(() => workspace.value?.venue.id ?? "");
const route = useRoute();
const { garnishQuery: createGarnishQuery } = useGarnishes(companyId, venueId, { list: false });
const garnishQuery = createGarnishQuery(() => props.garnishId);
const garnish = computed(() => garnishQuery.data.value ?? null);
const drawerVisible = ref(false);
const canManage = computed(() => workspace.value?.permissions.includes("manage_products") ?? false);
const listLocation = computed(() => ({
  path: `/app/companies/${companyId.value}/venues/${venueId.value}/garnishes`,
  query: {
    query:
      typeof route.query.query === "string" ? route.query.query.trim() || undefined : undefined,
  },
}));
const historyLocation = computed(() => ({
  path: `/app/companies/${companyId.value}/venues/${venueId.value}/history`,
  query: { entityType: "PRODUCT", entityId: props.garnishId },
}));
function preparationPath(id: string): string {
  return `/app/companies/${companyId.value}/venues/${venueId.value}/preparations/${id}`;
}
async function refreshGarnish(): Promise<void> {
  await garnishQuery.refetch();
}
</script>
