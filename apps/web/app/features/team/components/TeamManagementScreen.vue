<template>
  <div v-if="loading" class="pt-8">
    <LoadingIndicator screen />
  </div>
  <div v-else-if="!hasTeamData" class="pt-8">
    <Message severity="error" :closable="false" :pt="compactMessagePt">
      Не удалось загрузить команду. Обновите страницу и попробуйте ещё раз.
    </Message>
  </div>
  <section v-else class="space-y-6">
    <header class="flex items-center justify-between gap-4">
      <h1 class="text-xl font-semibold">График работы</h1>
      <Button
        v-if="canOpenManagement"
        label="Управление командой"
        size="small"
        @click="openManagementDrawer"
      />
    </header>
    <ScheduleScreen :workspace="workspace" :preview-mode="previewMode" />
    <Drawer
      v-model:visible="managementDrawerVisible"
      header="Управление командой"
      position="right"
      class="w-full sm:!w-96"
      :pt="{
        title: { style: { fontSize: '1rem', fontWeight: '600' } },
        pcCloseButton: { root: { class: '!rounded-md' } },
      }"
    >
      <div class="space-y-5">
        <Message v-if="error" severity="error" :closable="false" :pt="compactMessagePt">{{
          error
        }}</Message>
        <Message
          v-if="canInviteChef && chefTeamQuery.isError.value"
          severity="error"
          :closable="false"
          :pt="compactMessagePt"
        >
          Не удалось загрузить список приглашений шеф-барменов.
        </Message>
        <template v-if="canInvite">
          <InviteEmployeeForm
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
        </template>
        <Divider v-if="canInvite && canManageTeam" />
        <section v-if="canManageTeam" class="space-y-4">
          <h2 class="text-base font-semibold">Увольнение сотрудника</h2>
          <FloatLabel variant="on">
            <Select
              v-model="selectedMemberId"
              input-id="team-termination-member"
              :options="employeeOptions"
              option-label="label"
              option-value="id"
              size="small"
              class="w-full"
              :disabled="terminationBusy || !employeeOptions.length"
            />
            <label for="team-termination-member" class="text-xs">Сотрудник</label>
          </FloatLabel>
          <div class="flex items-end gap-2">
            <FloatLabel variant="on" class="min-w-0 flex-1">
              <DatePicker
                v-model="terminationDate"
                input-id="team-termination-date"
                date-format="dd.mm.yy"
                size="small"
                :manual-input="false"
                show-icon
                icon-display="input"
                show-clear
                :min-date="today"
                class="w-full"
                :disabled="terminationBusy || !selectedMember"
              />
              <label for="team-termination-date" class="text-xs">Дата увольнения</label>
            </FloatLabel>
            <Button
              label="Уволить"
              severity="danger"
              variant="outlined"
              size="small"
              :disabled="terminationBusy || !selectedMember || !terminationDate"
              @click="requestTermination"
            />
          </div>
          <Message
            v-if="terminationError"
            severity="error"
            :closable="false"
            :pt="compactMessagePt"
          >
            {{ terminationError }}
          </Message>
          <Divider />
          <section class="space-y-3">
            <h3 class="text-sm font-semibold">Ожидают увольнения</h3>
            <p v-if="!scheduledDepartures.length" class="text-sm text-color-secondary">
              Нет запланированных увольнений
            </p>
            <ul
              v-else
              class="divide-y divide-surface overflow-hidden rounded-lg border border-surface"
            >
              <li
                v-for="member in scheduledDepartures"
                :key="member.id"
                class="flex flex-wrap items-center gap-2 p-3 text-sm"
              >
                <span class="min-w-0 flex-1 font-medium">{{ member.fullName }}</span>
                <Tag :value="roleLabel(member.role)" severity="secondary" />
                <span class="w-full text-right text-color-secondary">
                  {{ formatDate(member.terminationDate!) }}
                </span>
              </li>
            </ul>
          </section>
        </section>
      </div>
    </Drawer>
    <Dialog
      v-model:visible="terminationConfirmationVisible"
      modal
      header="Подтвердить увольнение"
      class="w-full max-w-md"
      :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
    >
      <div v-if="selectedMember && terminationDate" class="space-y-4">
        <p class="text-sm">
          {{ selectedMember.fullName }} будет уволен с
          {{ formatDate(toDateKey(terminationDate)).replace(/г\.$/, "года") }}. Сотрудник потеряет
          доступ к заведению, а график с этой даты и далее будет очищен.
        </p>
        <Message
          v-if="terminationError"
          severity="error"
          :closable="false"
          :pt="compactMessagePt"
          >{{ terminationError }}</Message
        >
        <div class="flex justify-end gap-2">
          <Button
            label="Отмена"
            severity="secondary"
            variant="text"
            size="small"
            :disabled="terminationBusy"
            @click="terminationConfirmationVisible = false"
          />
          <Button
            label="Уволить"
            severity="danger"
            size="small"
            :loading="terminationBusy"
            :disabled="terminationBusy"
            @click="confirmTermination"
          />
        </div>
      </div>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import { compactMessagePt } from "~/utils/primevue-message";
import type { Workspace } from "~/types/user-workspaces";
import { useVenueTeam, type TeamMember, type VenueRole } from "../composables/useVenueTeam";
import { useCompanyChefTeam } from "../composables/useCompanyChefTeam";
import ScheduleScreen from "~/features/schedule/components/ScheduleScreen.vue";
import InviteEmployeeForm from "./InviteEmployeeForm.vue";
import InvitationList from "./InvitationList.vue";

const props = defineProps<{ workspace: Workspace }>();
const previewMode = import.meta.dev;
const { teamQuery, createInvitation, revokeInvitation, endMembership } = useVenueTeam(
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
const managementDrawerVisible = ref(false);
const terminationConfirmationVisible = ref(false);
const terminationBusy = ref(false);
const terminationError = ref("");
const selectedMemberId = ref<string | null>(null);
const terminationDate = ref<Date | null>(null);
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
const canManageTeam = props.workspace.permissions.includes("manage_team");
const canOpenManagement = computed(() => canInvite.value || canManageTeam);
const today = new Date();
const teamMembers = computed(() => teamQuery.data.value?.members ?? []);
const employeeOptions = computed(() =>
  teamMembers.value
    .filter((member) => !member.isCurrentUser && !member.terminationDate)
    .map((member) => ({
      id: member.id,
      label: `${member.fullName} · ${roleLabel(member.role)}`,
    })),
);
const selectedMember = computed<TeamMember | null>(
  () => teamMembers.value.find(({ id }) => id === selectedMemberId.value) ?? null,
);
const scheduledDepartures = computed(() =>
  teamMembers.value.filter((member) => Boolean(member.terminationDate)),
);

function openManagementDrawer(): void {
  selectedMemberId.value = null;
  terminationDate.value = null;
  terminationError.value = "";
  error.value = "";
  managementDrawerVisible.value = true;
}

function requestTermination(): void {
  if (!canManageTeam || !selectedMember.value || !terminationDate.value) return;
  terminationError.value = "";
  terminationConfirmationVisible.value = true;
}

async function confirmTermination(): Promise<void> {
  if (!canManageTeam || !selectedMember.value || !terminationDate.value) return;
  terminationBusy.value = true;
  terminationError.value = "";
  try {
    await endMembership(selectedMember.value.id, toDateKey(terminationDate.value));
    terminationConfirmationVisible.value = false;
    selectedMemberId.value = null;
    terminationDate.value = null;
  } catch (cause) {
    terminationError.value =
      cause instanceof Error ? cause.message : "Не удалось уволить сотрудника";
  } finally {
    terminationBusy.value = false;
  }
}

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

function roleLabel(role: VenueRole): string {
  return {
    BARTENDER: "Бармен",
    BARBACK: "Барбек",
    TRAINEE: "Стажёр",
    SENIOR_BARTENDER: "Старший бармен",
    BAR_MANAGER: "Бар-менеджер",
  }[role];
}

function toDateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" }).format(
    new Date(year, month - 1, day),
  );
}
</script>
