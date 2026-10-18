<template>
  <section class="space-y-4 border-t border-surface pt-6">
    <header>
      <h2 class="text-xl font-semibold">Шеф-бармены компании</h2>
      <p class="mt-2 text-sm text-color-secondary">
        Шеф-бармены видят все заведения компании. Приглашение отправляется на указанную почту.
      </p>
    </header>
    <LoadingIndicator v-if="teamQuery.isLoading.value" />
    <Message v-else-if="teamQuery.isError.value" severity="error" :closable="false">
      Не удалось загрузить шеф-барменов. Обновите страницу и попробуйте ещё раз.
    </Message>
    <template v-else>
      <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
      <section v-if="canInvite" class="space-y-3">
        <h3 class="text-lg font-semibold">Пригласить шеф-бармена</h3>
        <ChefInvitationForm :busy="busy" @submit="invite" />
      </section>
      <ChefMemberList :members="members" />
      <ChefInvitationList :invitations="invitations" :busy-id="busyId" @revoke="revoke" />
    </template>
  </section>
</template>

<script setup lang="ts">
import type { Workspace } from "~/types/user-workspaces";
import { useCompanyChefTeam } from "../composables/useCompanyChefTeam";
import ChefInvitationForm from "./ChefInvitationForm.vue";
import ChefInvitationList from "./ChefInvitationList.vue";
import ChefMemberList from "./ChefMemberList.vue";

const props = defineProps<{ workspace: Workspace }>();
const { teamQuery, createInvitation, revokeInvitation } = useCompanyChefTeam(
  props.workspace.company.id,
);
const error = ref("");
const busy = ref(false);
const busyId = ref("");
const members = computed(() => teamQuery.data.value?.members ?? []);
const invitations = computed(() => teamQuery.data.value?.invitations ?? []);
const canInvite = computed(() => props.workspace.permissions.includes("invite_chef_bartender"));

async function invite(email: string): Promise<void> {
  busy.value = true;
  error.value = "";
  try {
    await createInvitation(email);
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
</script>
