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
    <TeamManagementContent v-if="canManagePage" :workspace="workspace" />
    <div v-else class="mx-auto max-w-5xl pt-8">
      <Message severity="error" :closable="false" :pt="compactMessagePt">
        У вас нет доступа к управлению командой.
      </Message>
    </div>
  </WorkspaceShell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import { compactMessagePt } from "~/utils/primevue-message";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import TeamManagementContent from "./TeamManagementContent.vue";

const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
const canManagePage = computed(() => workspace.value?.role === "bar_manager");
</script>
