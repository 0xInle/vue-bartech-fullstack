<template>
  <div v-if="!canOpenManagement" class="mx-auto max-w-5xl pt-8">
    <Message severity="error" :closable="false" :pt="compactMessagePt">
      У вас нет доступа к управлению командой.
    </Message>
  </div>
  <div v-else-if="teamQuery.isLoading.value" class="mx-auto max-w-5xl pt-8">
    <LoadingIndicator screen />
  </div>
  <div v-else-if="teamQuery.isError.value || !teamQuery.data.value" class="mx-auto max-w-5xl pt-8">
    <Message severity="error" :closable="false" :pt="compactMessagePt">
      Не удалось загрузить команду. Обновите страницу и попробуйте ещё раз.
    </Message>
  </div>
  <section
    v-else
    class="flex flex-col gap-4 lg:h-[calc(100vh-6rem)] lg:min-h-0 xl:h-[calc(100vh-3rem)]"
  >
    <h1 class="text-xl font-semibold">Управление командой</h1>
    <div class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,65fr)_auto_minmax(0,35fr)]">
      <section class="flex min-h-0 min-w-0 flex-col gap-3">
        <h2 class="text-base font-semibold">Сотрудники</h2>
        <div class="relative h-96 min-h-0 overflow-hidden lg:h-full lg:flex-1">
          <TeamMembersTable :members="displayedMembers" @edit="openMemberEditor" />
        </div>
      </section>
      <Divider layout="vertical" class="!mx-0 !my-0 !hidden self-stretch lg:!flex" />
      <Divider class="!my-0 lg:!hidden" />
      <aside v-if="canInvite || canManageTeam" class="min-h-0 min-w-0 overflow-y-auto">
        <div class="space-y-4">
          <TeamInvitationPanel
            v-if="canInvite"
            :allow-venue-invites="canInviteVenue"
            :allow-bar-manager="workspace.permissions.includes('invite_bar_manager')"
            :allow-chef-bartender="canInviteChef"
            :busy="invitationBusy"
            :busy-id="busyInvitationId"
            :error="invitationError"
            :chef-error="canInviteChef && chefTeamQuery.isError.value"
            :loading="chefTeamQuery.isLoading.value"
            :invitations="pendingInvitations"
            @submit="invite"
            @revoke="revoke"
          />
          <Divider v-if="canInvite && canManageTeam" />
          <TeamTerminationPanel
            v-if="canManageTeam"
            :members="teamQuery.data.value.members"
            :end-membership="endMembership"
          />
        </div>
      </aside>
    </div>
    <TeamMemberEditorDrawer
      :member="editingMember"
      :busy="editorBusy"
      :error="editorError"
      @close="closeMemberEditor"
      @confirm-role="confirmMemberRole"
      @save="saveMember"
    />
  </section>
</template>

<script setup lang="ts">
import type { Workspace } from "~/types/user-workspaces";
import { compactMessagePt } from "~/utils/primevue-message";
import { PREVIEW_TEAM_ROSTER } from "~/utils/preview-team-roster";
import {
  useVenueTeam,
  type TeamMember,
  type UpdateTeamMemberInput,
  type VenueRole,
} from "../composables/useVenueTeam";
import { useCompanyChefTeam } from "../composables/useCompanyChefTeam";
import TeamMemberEditorDrawer from "./TeamMemberEditorDrawer.vue";
import TeamMembersTable from "./TeamMembersTable.vue";
import TeamInvitationPanel from "./TeamInvitationPanel.vue";
import TeamTerminationPanel from "./TeamTerminationPanel.vue";

const props = defineProps<{ workspace: Workspace }>();
const { teamQuery, createInvitation, revokeInvitation, updateMember, endMembership } = useVenueTeam(
  props.workspace.company.id,
  props.workspace.venue.id,
);
type TeamMemberRow = TeamMember & { isPreview?: true };
const previewMembers = ref<TeamMemberRow[]>(createPreviewMembers());
const displayedMembers = computed(() => [
  ...(teamQuery.data.value?.members ?? []),
  ...previewMembers.value,
]);
const canInviteVenue = props.workspace.permissions.includes("invite_employees");
const canInviteChef = props.workspace.permissions.includes("invite_chef_bartender");
const canInvite = canInviteVenue || canInviteChef;
const canManageTeam = props.workspace.permissions.includes("manage_team");
const canOpenManagement = props.workspace.role === "bar_manager";
const chefTeam = useCompanyChefTeam(props.workspace.company.id, canInviteChef);
const chefTeamQuery = chefTeam.teamQuery;
const { createInvitation: createChefInvitation, revokeInvitation: revokeChefInvitation } = chefTeam;
const invitationBusy = ref(false);
const invitationError = ref("");
const busyInvitationId = ref("");
const editingMember = ref<TeamMemberRow | null>(null);
const editorBusy = ref(false);
const editorError = ref("");
const pendingInvitations = computed(() => [
  ...(teamQuery.data.value?.invitations ?? []).map((invitation) => ({
    ...invitation,
    scope: "venue" as const,
  })),
  ...(chefTeamQuery.data.value?.invitations ?? []).map((invitation) => ({
    ...invitation,
    role: "CHEF_BARTENDER" as const,
    canRevoke: true,
    scope: "company" as const,
  })),
]);

async function invite(email: string, role: VenueRole | "CHEF_BARTENDER"): Promise<void> {
  invitationBusy.value = true;
  invitationError.value = "";
  try {
    if (role === "CHEF_BARTENDER") await createChefInvitation(email);
    else await createInvitation(email, role);
  } catch (cause) {
    invitationError.value =
      cause instanceof Error ? cause.message : "Не удалось создать приглашение";
  } finally {
    invitationBusy.value = false;
  }
}

async function revoke(invitation: { id: string; scope: "venue" | "company" }): Promise<void> {
  busyInvitationId.value = invitation.id;
  invitationError.value = "";
  try {
    if (invitation.scope === "company") await revokeChefInvitation(invitation.id);
    else await revokeInvitation(invitation.id);
  } catch (cause) {
    invitationError.value =
      cause instanceof Error ? cause.message : "Не удалось отозвать приглашение";
  } finally {
    busyInvitationId.value = "";
  }
}

function openMemberEditor(member: TeamMemberRow): void {
  editorError.value = "";
  editingMember.value = member;
}

function closeMemberEditor(): void {
  if (editorBusy.value) return;
  editingMember.value = null;
  editorError.value = "";
}

watch(
  () => teamQuery.data.value?.members.find(({ id }) => id === editingMember.value?.id),
  (member) => {
    if (member && editingMember.value && !editingMember.value.isPreview) {
      editingMember.value = member;
    }
  },
);

async function confirmMemberRole(role: VenueRole): Promise<void> {
  if (!editingMember.value) return;
  editorBusy.value = true;
  editorError.value = "";
  try {
    if (editingMember.value.isPreview) {
      const permissions = defaultPreviewPermissions(role);
      previewMembers.value = previewMembers.value.map((member) =>
        member.id === editingMember.value?.id
          ? {
              ...member,
              role,
              permissions,
            }
          : member,
      );
    } else {
      await updateMember(editingMember.value.id, { role, permissions: [] });
    }
  } catch (cause) {
    editorError.value = cause instanceof Error ? cause.message : "Не удалось изменить должность";
  } finally {
    editorBusy.value = false;
  }
}

async function saveMember(input: UpdateTeamMemberInput): Promise<void> {
  if (!editingMember.value) return;
  editorBusy.value = true;
  editorError.value = "";
  try {
    if (editingMember.value.isPreview) {
      previewMembers.value = previewMembers.value.map((member) =>
        member.id === editingMember.value?.id
          ? {
              ...member,
              ...input,
            }
          : member,
      );
    } else {
      await updateMember(editingMember.value.id, input);
    }
    editingMember.value = null;
  } catch (cause) {
    editorError.value = cause instanceof Error ? cause.message : "Не удалось изменить сотрудника";
  } finally {
    editorBusy.value = false;
  }
}

function createPreviewMembers(): TeamMemberRow[] {
  if (!import.meta.dev) return [];
  const availableRoles: VenueRole[] = [
    "BARTENDER",
    "SENIOR_BARTENDER",
    "BARBACK",
    "TRAINEE",
    "BAR_MANAGER",
  ];
  const delegatablePermissions = [
    "manage_products",
    "manage_product_archive",
    "delete_products_permanently",
    "export_data",
    "invite_employees",
    "manage_schedule",
  ];
  return PREVIEW_TEAM_ROSTER.map((employee, index) => ({
    id: `preview-team-member-${index + 1}`,
    fullName: employee.name,
    email: `demo-${index + 1}@example.test`,
    role: employee.role,
    terminationDate: null,
    permissions: defaultPreviewPermissions(employee.role),
    availableRoles,
    availablePermissions: [
      ...new Set([...defaultPreviewPermissions(employee.role), ...delegatablePermissions]),
    ],
    canManagePermissionOverrides: true,
    isCurrentUser: false,
    isPreview: true,
  }));
}

function defaultPreviewPermissions(role: VenueRole): string[] {
  if (role === "BAR_MANAGER") {
    return [
      "view_products",
      "view_archive",
      "view_team",
      "view_schedule",
      "manage_products",
      "manage_product_archive",
      "delete_products_permanently",
      "export_data",
      "invite_employees",
      "invite_bar_manager",
      "invite_chef_bartender",
      "create_venues",
      "manage_team",
      "manage_delegated_permissions",
      "manage_venue",
      "manage_company",
      "view_history",
      "manage_schedule",
    ];
  }
  if (role === "SENIOR_BARTENDER") {
    return ["view_products", "view_archive", "view_team", "view_schedule", "manage_products"];
  }
  return ["view_products", "view_archive", "view_team", "view_schedule"];
}
</script>
