<template>
  <div v-if="loading" class="mx-auto max-w-5xl pt-8">
    <Message severity="info" :closable="false">Загружаем рабочее пространство…</Message>
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
    <ProductExportsScreen
      :company-id="companyId"
      :venue-id="venueId"
      :permissions="workspace.permissions"
    />
  </WorkspaceShell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import ProductExportsScreen from "~/features/exports/components/ProductExportsScreen.vue";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";

defineOptions({ name: "ProductExportsPage" });

const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
const companyId = computed(() => workspace.value?.company.id ?? "");
const venueId = computed(() => workspace.value?.venue.id ?? "");
</script>
