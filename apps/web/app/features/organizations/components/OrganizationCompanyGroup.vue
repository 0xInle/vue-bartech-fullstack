<template>
  <section>
    <div class="flex items-center justify-between gap-2">
      <div class="flex min-w-0 flex-wrap items-center gap-x-1">
        <h2 class="text-xs font-medium text-color-secondary">Рабочие пространства</h2>
        <span class="text-xs font-semibold">{{ company.name }}</span>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <Button
          v-if="canManageCompany"
          v-tooltip.top="{ value: 'Закрыть компанию', class: 'app-tooltip' }"
          type="button"
          icon="pi pi-times-circle"
          aria-label="Закрыть компанию"
          severity="secondary"
          variant="text"
          size="small"
          class="workspace-action-icon-button"
          @click="lifecyclePanel?.openCompanyClosure()"
        />
        <Button
          v-tooltip.top="{ value: 'Выйти из компании', class: 'app-tooltip' }"
          type="button"
          icon="pi pi-sign-out"
          aria-label="Выйти из компании"
          severity="secondary"
          variant="text"
          size="small"
          class="workspace-action-icon-button"
          @click="companyExitDialog?.open()"
        />
      </div>
    </div>
    <ul v-if="workplaces.length" class="mt-4 space-y-4">
      <li v-for="workplace in workplaces" :key="workplace.venue.id">
        <OrganizationVenueCard :workspace="workplace" />
      </li>
    </ul>
    <p v-else class="brand-description mt-4 text-sm">В этой компании пока нет заведений.</p>
    <NuxtLink
      v-if="!workplaces.length"
      :to="`/app/companies/${company.id}`"
      class="mt-4 inline-block text-sm font-medium text-primary"
    >
      Открыть управление компанией
    </NuxtLink>
    <div class="mt-4">
      <Button
        v-if="createWorkspace || canCreateEmptyVenue"
        type="button"
        label="Создать рабочее пространство"
        size="small"
        class="w-full"
        @click="openVenueDialog?.open()"
      />
    </div>
    <OpenVenueDialog
      v-if="createWorkspace || canCreateEmptyVenue"
      ref="openVenueDialog"
      :company-id="company.id"
    />
    <CompanyExitDialog
      ref="companyExitDialog"
      :company="company"
      :venue-names="workplaces.map(({ venue }) => venue.name)"
    />
    <OrganizationLifecyclePanel
      v-if="canManageCompany"
      ref="lifecyclePanel"
      :workspace="chefWorkspace ?? undefined"
      :company="chefWorkspace ? undefined : company"
      :show-actions="false"
    />
  </section>
</template>

<script setup lang="ts">
import type { CompanySummary, Workspace } from "~/types/user-workspaces";
import OpenVenueDialog from "./OpenVenueDialog.vue";
import CompanyExitDialog from "./CompanyExitDialog.vue";
import OrganizationLifecyclePanel from "./OrganizationLifecyclePanel.vue";
import OrganizationVenueCard from "./OrganizationVenueCard.vue";

const props = defineProps<{
  company: CompanySummary;
  workplaces: Workspace[];
}>();
const createWorkspace = computed(
  () => props.workplaces.find((item) => item.permissions.includes("create_venues")) ?? null,
);
const chefWorkspace = computed(
  () => props.workplaces.find((item) => item.role === "chef_bartender") ?? null,
);
const canCreateEmptyVenue = computed(() => props.workplaces.length === 0);
const canManageCompany = computed(() => Boolean(chefWorkspace.value) || canCreateEmptyVenue.value);
const openVenueDialog = ref<InstanceType<typeof OpenVenueDialog> | null>(null);
const companyExitDialog = ref<InstanceType<typeof CompanyExitDialog> | null>(null);
const lifecyclePanel = ref<InstanceType<typeof OrganizationLifecyclePanel> | null>(null);
</script>
