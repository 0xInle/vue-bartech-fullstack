<template>
  <div v-if="loading" class="mx-auto max-w-5xl pt-8">
    <LoadingIndicator screen />
  </div>
  <div v-else-if="errorMessage" class="mx-auto max-w-5xl pt-8">
    <Message severity="error" :closable="false" :pt="compactMessagePt">{{ errorMessage }}</Message>
  </div>
  <WorkspaceShell
    v-else-if="workspace && currentUser"
    :workspace="workspace"
    :workplaces="workplaces"
    :full-name="currentUser.fullName"
    @switch="switchWorkspace"
  >
    <WorkspaceProductSearch :workspace="workspace" mode="home" />
  </WorkspaceShell>
</template>

<script setup lang="ts">
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import { compactMessagePt } from "~/utils/primevue-message";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import WorkspaceProductSearch from "~/features/products/components/WorkspaceProductSearch.vue";

defineOptions({ name: "VenueHomeScreen" });

const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
</script>
