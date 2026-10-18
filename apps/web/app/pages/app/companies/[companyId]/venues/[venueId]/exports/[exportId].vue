<template>
  <div v-if="loading" class="mx-auto max-w-5xl pt-8">
    <LoadingIndicator />
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
      :export-id="exportId"
      :permissions="workspace.permissions"
    />
  </WorkspaceShell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import ProductExportsScreen from "~/features/exports/components/ProductExportsScreen.vue";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";

const route = useRoute();
const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
const companyId = computed(() => workspace.value?.company.id ?? "");
const venueId = computed(() => workspace.value?.venue.id ?? "");
const exportId = computed(() => String(route.params.exportId ?? ""));
</script>
