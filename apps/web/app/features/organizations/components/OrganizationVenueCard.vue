<template>
  <article
    class="flex items-center justify-between gap-3 rounded-xl border p-4 shadow-sm"
    style="border-color: var(--p-content-border-color)"
  >
    <NuxtLink
      :to="`/app/companies/${workspace.company.id}/venues/${workspace.venue.id}`"
      class="workspace-link min-w-0 flex-1"
    >
      <span class="brand-eyebrow block truncate text-xs font-semibold uppercase">
        {{ workspace.venue.name }}
      </span>
      <span class="brand-description mt-2 block text-xs">{{ workspace.roleLabel }}</span>
    </NuxtLink>
    <div class="flex items-center gap-1">
      <Button
        v-if="canCloseVenue"
        v-tooltip.top="{ value: 'Закрыть', class: 'app-tooltip' }"
        type="button"
        icon="pi pi-times-circle"
        aria-label="Закрыть заведение"
        severity="secondary"
        variant="text"
        size="small"
        class="workspace-action-icon-button"
        @click="lifecyclePanel?.openVenueClosure()"
      />
      <Button
        v-if="canLeaveVenue"
        v-tooltip.top="{ value: 'Выйти', class: 'app-tooltip' }"
        type="button"
        icon="pi pi-sign-out"
        aria-label="Выйти из заведения"
        severity="secondary"
        variant="text"
        size="small"
        class="workspace-action-icon-button"
        @click="lifecyclePanel?.openSelfLeave()"
      />
    </div>
    <OrganizationLifecyclePanel
      v-if="canCloseVenue || canLeaveVenue"
      ref="lifecyclePanel"
      :workspace="workspace"
      :show-actions="false"
    />
  </article>
</template>

<script setup lang="ts">
import type { Workspace } from "~/types/user-workspaces";
import OrganizationLifecyclePanel from "./OrganizationLifecyclePanel.vue";

const props = defineProps<{ workspace: Workspace }>();
const lifecyclePanel = ref<InstanceType<typeof OrganizationLifecyclePanel> | null>(null);
const canCloseVenue = computed(() => props.workspace.permissions.includes("manage_venue"));
const canLeaveVenue = computed(
  () =>
    props.workspace.role === "bar_manager" ||
    props.workspace.role === "senior_bartender" ||
    props.workspace.role === "bartender",
);
</script>
