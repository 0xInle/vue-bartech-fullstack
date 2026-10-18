<template>
  <section class="mx-auto max-w-5xl space-y-8">
    <header>
      <p class="text-sm font-medium text-primary">{{ workspace.company.name }}</p>
      <h1 class="mt-1 text-2xl font-semibold">Управление заведениями</h1>
      <p class="mt-2 text-sm text-color-secondary">
        Откройте заведение или пригласите бар-менеджера. Здесь отображаются только доступные вам
        заведения компании.
      </p>
    </header>

    <Message v-if="createError" severity="error" :closable="false">{{ createError }}</Message>
    <section v-if="canCreateVenue" class="space-y-3">
      <h2 class="text-lg font-semibold">Открыть заведение самостоятельно</h2>
      <p class="text-sm text-color-secondary">
        Вы станете бар-менеджером нового заведения. Ваши роли в других заведениях не изменятся.
      </p>
      <form class="flex flex-col gap-3 sm:flex-row" @submit.prevent="openVenue">
        <InputText
          v-model="venueName"
          size="small"
          class="w-full sm:max-w-md"
          maxlength="120"
          required
          aria-label="Название заведения"
          placeholder="Название заведения"
        />
        <Button label="Открыть заведение" size="small" type="submit" :loading="creating" />
      </form>
    </section>

    <CompanyVenueInvitationScreen
      v-if="canInviteManager"
      :company="workspace.company"
      :can-invite="canInviteManager"
      :show-header="false"
    />

    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Доступные для управления заведения</h2>
      <Message v-if="managedWorkspaces.length === 0" severity="info" :closable="false">
        У вас пока нет заведений, доступных для управления.
      </Message>
      <article
        v-for="managedWorkspace in managedWorkspaces"
        :key="managedWorkspace.venue.id"
        class="space-y-3 rounded-xl border border-surface bg-surface-0 p-4"
      >
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 class="font-semibold">{{ managedWorkspace.venue.name }}</h3>
            <p class="text-sm text-color-secondary">{{ managedWorkspace.roleLabel }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button
              label="Перейти в заведение"
              severity="secondary"
              outlined
              size="small"
              @click="switchWorkspace(managedWorkspace)"
            />
            <Button
              label="Управлять заведением"
              severity="secondary"
              size="small"
              @click="openManagement(managedWorkspace)"
            />
          </div>
        </header>
        <OrganizationLifecyclePanel :workspace="managedWorkspace" :show-company-actions="false" />
      </article>
    </section>

    <section v-if="workspace.role === 'chef_bartender'" class="space-y-3">
      <h2 class="text-lg font-semibold">Управление компанией</h2>
      <OrganizationLifecyclePanel :company="workspace.company" />
    </section>
  </section>
</template>

<script setup lang="ts">
import { useVenueManagement } from "../composables/useVenueManagement";
import type { Workspace } from "~/types/user-workspaces";
import CompanyVenueInvitationScreen from "./CompanyVenueInvitationScreen.vue";
import OrganizationLifecyclePanel from "./OrganizationLifecyclePanel.vue";

const props = defineProps<{
  workspace: Workspace;
  refreshSession: () => Promise<void>;
  switchWorkspace: (workspace: Workspace) => Promise<void>;
}>();
const { canCreateVenue, canInviteManager, createVenue, managedWorkspaces } = useVenueManagement(
  props.workspace.company.id,
);
const venueName = ref("");
const creating = ref(false);
const createError = ref("");

async function openVenue(): Promise<void> {
  creating.value = true;
  createError.value = "";
  try {
    const result = await createVenue(venueName.value);
    await props.refreshSession();
    await navigateTo(result.redirectTo);
  } catch (error) {
    createError.value =
      error instanceof Error ? error.message : "Не удалось открыть заведение. Попробуйте ещё раз.";
  } finally {
    creating.value = false;
  }
}

async function openManagement(managedWorkspace: Workspace): Promise<void> {
  await navigateTo(
    `/app/companies/${managedWorkspace.company.id}/venues/${managedWorkspace.venue.id}/management`,
  );
}
</script>
