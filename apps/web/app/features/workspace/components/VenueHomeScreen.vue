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
    <section class="mx-auto max-w-5xl">
      <p class="text-sm font-medium text-emerald-700">{{ workspace.company.name }}</p>
      <h1 class="mt-2 text-2xl font-semibold">{{ workspace.venue.name }}</h1>
      <p class="mt-2 text-sm text-zinc-600">{{ workspace.roleLabel }}</p>
      <Message severity="info" :closable="false" class="mt-8">
        Рабочее пространство готово. Основные разделы продукции появятся по мере реализации MVP.
      </Message>
      <OrganizationLifecyclePanel :workspace="workspace" />
    </section>
  </WorkspaceShell>
</template>

<script setup lang="ts">
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import OrganizationLifecyclePanel from "~/features/organizations/components/OrganizationLifecyclePanel.vue";

defineOptions({ name: "VenueHomeScreen" });

const { currentUser, errorMessage, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
</script>
