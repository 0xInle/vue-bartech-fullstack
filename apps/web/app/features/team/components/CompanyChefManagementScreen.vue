<template>
  <div v-if="loading" class="mx-auto max-w-5xl pt-8">
    <Message severity="info" :closable="false">Загружаем шеф-барменов…</Message>
  </div>
  <div v-else-if="!hasData" class="mx-auto max-w-5xl pt-8">
    <Message severity="error" :closable="false">
      Не удалось загрузить управление шеф-барменами. Обновите страницу и попробуйте ещё раз.
    </Message>
  </div>
  <section v-else class="mx-auto max-w-5xl space-y-6">
    <header>
      <p class="text-sm font-medium text-emerald-700">{{ workspace.company.name }}</p>
      <h1 class="mt-1 text-2xl font-semibold">Шеф-бармены компании</h1>
      <p class="mt-2 text-sm text-zinc-600">
        Шеф-бармены видят все заведения компании. Приглашение отправляется на указанную почту.
      </p>
    </header>
    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
    <section v-if="canInvite" class="space-y-3">
      <h2 class="text-lg font-semibold">Пригласить шеф-бармена</h2>
      <ChefInvitationForm :busy="busy" @submit="invite" />
    </section>
    <ChefMemberList :members="members" />
    <ChefInvitationList :invitations="invitations" :busy-id="busyId" @revoke="revoke" />
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
const loading = computed(() => teamQuery.isLoading.value);
const hasData = computed(() => teamQuery.data.value !== undefined);
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
