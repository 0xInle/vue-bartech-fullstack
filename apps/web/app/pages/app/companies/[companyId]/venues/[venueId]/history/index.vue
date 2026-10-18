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
    <HistoryScreen :company-id="companyId" :venue-id="venueId" />
  </WorkspaceShell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import HistoryScreen from "~/features/history/components/HistoryScreen.vue";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";

defineOptions({ name: "HistoryPage" });

const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
const companyId = computed(() => workspace.value?.company.id ?? "");
const venueId = computed(() => workspace.value?.venue.id ?? "");
</script>
