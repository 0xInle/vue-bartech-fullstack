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
    <VenueManagementScreen
      :key="workspace.company.id"
      :workspace="workspace"
      :refresh-session="identity.loadSession"
      :switch-workspace="switchWorkspace"
    />
  </WorkspaceShell>
</template>

<script setup lang="ts">
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import VenueManagementScreen from "./VenueManagementScreen.vue";

const { currentUser, errorMessage, identity, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
</script>
