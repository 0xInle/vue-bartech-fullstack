<template>
  <div v-if="loading" class="mx-auto max-w-5xl pt-8">
    <LoadingIndicator screen />
  </div>
  <div v-else-if="!hasTeamData" class="mx-auto max-w-5xl pt-8">
    <Message severity="error" :closable="false">
      Не удалось загрузить команду. Обновите страницу и попробуйте ещё раз.
    </Message>
  </div>
  <section v-else class="mx-auto max-w-5xl space-y-8">
    <header class="flex items-center justify-between gap-4">
      <h1 class="text-2xl font-semibold">Команда</h1>
      <Button
        v-if="canInvite"
        label="Пригласить"
        size="small"
        @click="invitationDrawerVisible = true"
      />
    </header>
    <TeamMemberList :members="members" @edit="selectedMember = $event" />
    <TeamMemberEditorDrawer
      :member="selectedMember"
      :busy="savingMember"
      :error="memberError"
      @close="selectedMember = null"
      @save="saveMember"
    />
    <Drawer
      v-model:visible="invitationDrawerVisible"
      header="Пригласить сотрудника"
      position="right"
      class="w-full sm:!w-96"
      :pt="{
        title: { style: { fontSize: '1.125rem', fontWeight: '600' } },
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
import {
  useVenueTeam,
  type TeamMember,
  type UpdateTeamMemberInput,
  type VenueRole,
} from "../composables/useVenueTeam";
import { useCompanyChefTeam } from "../composables/useCompanyChefTeam";
import InviteEmployeeForm from "./InviteEmployeeForm.vue";
import InvitationList from "./InvitationList.vue";
import TeamMemberEditorDrawer from "./TeamMemberEditorDrawer.vue";
import TeamMemberList from "./TeamMemberList.vue";

const props = defineProps<{ workspace: Workspace }>();
const { teamQuery, createInvitation, revokeInvitation, updateMember } = useVenueTeam(
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
const selectedMember = ref<TeamMember | null>(null);
const savingMember = ref(false);
const memberError = ref("");
const members = computed(() => teamQuery.data.value?.members ?? []);
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

async function saveMember(input: UpdateTeamMemberInput): Promise<void> {
  if (!selectedMember.value) return;
  savingMember.value = true;
  memberError.value = "";
  try {
    await updateMember(selectedMember.value.id, input);
    selectedMember.value = null;
  } catch (cause) {
    memberError.value = cause instanceof Error ? cause.message : "Не удалось сохранить изменения";
  } finally {
    savingMember.value = false;
  }
}
</script>
