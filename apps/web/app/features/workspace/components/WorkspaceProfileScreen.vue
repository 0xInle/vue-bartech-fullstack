<template>
  <div v-if="loading" class="mx-auto max-w-5xl pt-8">
    <Message severity="info" :closable="false">Загружаем профиль…</Message>
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
    <AccountProfilePanel
      :full-name="currentUser.fullName"
      :email="currentUser.email"
      :workplaces="workplaces"
      :companies="currentUser.companies"
      :busy="busy"
      :error-message="actionError"
      @logout="runLogout(false)"
      @logout-all="runLogout(true)"
    />
  </WorkspaceShell>
</template>

<script setup lang="ts">
import AccountProfilePanel from "~/features/identity/components/AccountProfilePanel.vue";
import WorkspaceShell from "~/features/workspace/components/WorkspaceShell.vue";
import { useVenueWorkspace } from "~/features/workspace/composables/useVenueWorkspace";

defineOptions({ name: "WorkspaceProfileScreen" });

const { currentUser, errorMessage, identity, loading, switchWorkspace, workspace, workplaces } =
  useVenueWorkspace();
const busy = ref(false);
const actionError = ref("");

async function runLogout(allDevices: boolean): Promise<void> {
  busy.value = true;
  actionError.value = "";
  try {
    if (allDevices) await identity.logoutAll();
    else await identity.logout();
    await navigateTo("/");
  } catch (error) {
    actionError.value =
      error instanceof Error ? error.message : "Не удалось завершить сеанс. Попробуйте ещё раз.";
  } finally {
    busy.value = false;
  }
}
</script>
