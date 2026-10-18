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
    <header>
      <p class="text-sm font-medium text-emerald-700">{{ workspace.company.name }}</p>
      <h1 class="mt-1 text-2xl font-semibold">Команда · {{ workspace.venue.name }}</h1>
    </header>
    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
    <section v-if="canInvite" class="space-y-3">
      <h2 class="text-lg font-semibold">Пригласить сотрудника</h2>
      <InviteEmployeeForm
        :allow-bar-manager="workspace.permissions.includes('invite_bar_manager')"
        :busy="busy"
        @submit="invite"
      />
    </section>
    <TeamMemberList
      :members="members"
      :can-manage-team="workspace.permissions.includes('manage_team')"
      @edit="selectedMember = $event"
    />
    <TeamMemberEditorDrawer
      :member="selectedMember"
      :busy="savingMember"
      :error="memberError"
      @close="selectedMember = null"
      @save="saveMember"
    />
    <InvitationList :invitations="invitations" :busy-id="busyId" @revoke="revoke" />
    <ChefTeamSection
      v-if="workspace.permissions.includes('invite_chef_bartender')"
      :workspace="workspace"
    />
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
import InviteEmployeeForm from "./InviteEmployeeForm.vue";
import InvitationList from "./InvitationList.vue";
import TeamMemberEditorDrawer from "./TeamMemberEditorDrawer.vue";
import TeamMemberList from "./TeamMemberList.vue";
import ChefTeamSection from "./ChefTeamSection.vue";

const props = defineProps<{ workspace: Workspace }>();
const { teamQuery, createInvitation, revokeInvitation, updateMember } = useVenueTeam(
  props.workspace.company.id,
  props.workspace.venue.id,
);
const error = ref("");
const busy = ref(false);
const busyId = ref("");
const selectedMember = ref<TeamMember | null>(null);
const savingMember = ref(false);
const memberError = ref("");
const members = computed(() => teamQuery.data.value?.members ?? []);
const invitations = computed(() => teamQuery.data.value?.invitations ?? []);
const loading = computed(() => teamQuery.isLoading.value);
const hasTeamData = computed(() => teamQuery.data.value !== undefined);
const canInvite = computed(() => props.workspace.permissions.includes("invite_employees"));

async function invite(email: string, role: VenueRole): Promise<void> {
  busy.value = true;
  error.value = "";
  try {
    await createInvitation(email, role);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Не удалось создать приглашение";
  } finally {
    busy.value = false;
  }
}

async function revoke(invitationId: string): Promise<void> {
  busyId.value = invitationId;
  error.value = "";
  try {
    await revokeInvitation(invitationId);
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
