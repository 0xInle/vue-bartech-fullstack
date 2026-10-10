<template>
  <div v-if="invitationsQuery.isLoading.value" class="mx-auto max-w-5xl pt-8">
    <Message severity="info" :closable="false">Загружаем приглашения…</Message>
  </div>
  <div v-else-if="invitationsQuery.isError.value" class="mx-auto max-w-5xl pt-8">
    <Message severity="error" :closable="false">
      Не удалось загрузить приглашения. Обновите страницу и попробуйте ещё раз.
    </Message>
  </div>
  <section v-else class="mx-auto max-w-5xl space-y-6">
    <header>
      <p class="text-sm font-medium text-emerald-700">{{ company.name }}</p>
      <h1 class="mt-1 text-2xl font-semibold">Новое заведение</h1>
      <p class="mt-2 text-sm text-zinc-600">
        Пригласите бар-менеджера. Он укажет название заведения при принятии приглашения.
      </p>
    </header>
    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
    <section v-if="canInvite" class="space-y-3">
      <h2 class="text-lg font-semibold">Пригласить бар-менеджера</h2>
      <CompanyVenueInvitationForm :busy="busy" @submit="invite" />
    </section>
    <CompanyVenueInvitationList :invitations="invitations" :busy-id="busyId" @revoke="revoke" />
  </section>
</template>

<script setup lang="ts">
import type { CompanySummary } from "~/types/user-workspaces";
import { useCompanyVenueInvitations } from "../composables/useCompanyVenueInvitations";
import CompanyVenueInvitationForm from "./CompanyVenueInvitationForm.vue";
import CompanyVenueInvitationList from "./CompanyVenueInvitationList.vue";

const props = defineProps<{ company: CompanySummary; canInvite: boolean }>();
const { invitationsQuery, createInvitation, revokeInvitation } = useCompanyVenueInvitations(
  props.company.id,
);
const error = ref("");
const busy = ref(false);
const busyId = ref("");
const invitations = computed(() => invitationsQuery.data.value?.invitations ?? []);

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
