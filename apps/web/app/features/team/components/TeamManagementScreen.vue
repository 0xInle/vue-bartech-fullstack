<template>
  <div v-if="loading" class="pt-8">
    <LoadingIndicator screen />
  </div>
  <div v-else-if="!hasTeamData" class="pt-8">
    <Message severity="error" :closable="false">
      Не удалось загрузить команду. Обновите страницу и попробуйте ещё раз.
    </Message>
  </div>
  <section v-else class="space-y-6">
    <header class="flex items-center justify-between gap-4">
      <h1 class="text-xl font-semibold">Команда</h1>
      <Button
        v-if="canInvite"
        label="Пригласить"
        size="small"
        @click="invitationDrawerVisible = true"
      />
    </header>
    <ScheduleScreen :workspace="workspace" :preview-mode="previewMode" />
    <Drawer
      v-model:visible="invitationDrawerVisible"
      header="Пригласить сотрудника"
      position="right"
      class="w-full sm:!w-96"
      :pt="{
        title: { style: { fontSize: '1rem', fontWeight: '600' } },
        pcCloseButton: { root: { class: '!rounded-md' } },
      }"
    >
      <div class="space-y-5">
        <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
        <Message
          v-if="canInviteChef && chefTeamQuery.isError.value"
          severity="error"
          :closable="false"
        >
          Не удалось загрузить список приглашений шеф-барменов.
        </Message>
        <InviteEmployeeForm
          v-if="canInvite"
          :allow-venue-invites="canInviteVenue"
          :allow-bar-manager="workspace.permissions.includes('invite_bar_manager')"
          :allow-chef-bartender="canInviteChef"
          :busy="busy"
          @submit="invite"
        />
        <div v-if="teamQuery.isLoading.value || chefTeamQuery.isLoading.value" class="py-4">
          <LoadingIndicator />
        </div>
        <InvitationList
          v-else
          :invitations="pendingInvitations"
          :busy-id="busyId"
          @revoke="revoke"
        />
      </div>
    </Drawer>
  </section>
</template>

<script setup lang="ts">
import type { Workspace } from "~/types/user-workspaces";
import { useVenueTeam, type VenueRole } from "../composables/useVenueTeam";
import { useCompanyChefTeam } from "../composables/useCompanyChefTeam";
import ScheduleScreen from "~/features/schedule/components/ScheduleScreen.vue";
import InviteEmployeeForm from "./InviteEmployeeForm.vue";
import InvitationList from "./InvitationList.vue";

const props = defineProps<{ workspace: Workspace }>();
const previewMode = import.meta.dev;
const { teamQuery, createInvitation, revokeInvitation } = useVenueTeam(
  props.workspace.company.id,
  props.workspace.venue.id,
);
const canInviteChef = props.workspace.permissions.includes("invite_chef_bartender");
const chefTeam = useCompanyChefTeam(props.workspace.company.id, canInviteChef);
const chefTeamQuery = chefTeam.teamQuery;
const { createInvitation: createChefInvitation, revokeInvitation: revokeChefInvitation } = chefTeam;
const error = ref("");
const busy = ref(false);
const busyId = ref("");
const invitationDrawerVisible = ref(false);
const invitations = computed(() => teamQuery.data.value?.invitations ?? []);
const pendingInvitations = computed(() => [
  ...invitations.value.map((invitation) => ({ ...invitation, scope: "venue" as const })),
  ...(chefTeamQuery.data.value?.invitations ?? []).map((invitation) => ({
    ...invitation,
    role: "CHEF_BARTENDER" as const,
    canRevoke: true,
    scope: "company" as const,
  })),
]);
const loading = computed(() => teamQuery.isLoading.value);
const hasTeamData = computed(() => teamQuery.data.value !== undefined);
const canInviteVenue = props.workspace.permissions.includes("invite_employees");
const canInvite = computed(() => canInviteVenue || canInviteChef);

async function invite(email: string, role: VenueRole | "CHEF_BARTENDER"): Promise<void> {
  busy.value = true;
  error.value = "";
  try {
    if (role === "CHEF_BARTENDER") {
      await createChefInvitation(email);
    } else {
      await createInvitation(email, role);
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Не удалось создать приглашение";
  } finally {
    busy.value = false;
  }
}

async function revoke(invitation: { id: string; scope: "venue" | "company" }): Promise<void> {
  busyId.value = invitation.id;
  error.value = "";
  try {
    if (invitation.scope === "company") {
      await revokeChefInvitation(invitation.id);
    } else {
      await revokeInvitation(invitation.id);
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Не удалось отозвать приглашение";
  } finally {
    busyId.value = "";
  }
}
</script>
