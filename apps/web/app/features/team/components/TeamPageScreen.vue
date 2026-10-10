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
    <TeamManagementScreen :workspace="workspace" />
  </WorkspaceShell>
</template>

<script setup lang="ts">
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import TeamManagementScreen from "./TeamManagementScreen.vue";

const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
</script>
