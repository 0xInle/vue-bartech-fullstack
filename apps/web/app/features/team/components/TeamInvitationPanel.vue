<template>
  <section class="space-y-4">
    <h2 class="text-base font-semibold">Приглашение сотрудника</h2>
    <Message v-if="error" severity="error" :closable="false" :pt="compactMessagePt">{{
      error
    }}</Message>
    <Message v-if="chefError" severity="error" :closable="false" :pt="compactMessagePt">
      Не удалось загрузить приглашения шеф-барменов.
    </Message>
    <InviteEmployeeForm
      :allow-venue-invites="allowVenueInvites"
      :allow-bar-manager="allowBarManager"
      :allow-chef-bartender="allowChefBartender"
      :busy="busy"
      @submit="submit"
    />
    <Divider />
    <div v-if="loading" class="py-4">
      <LoadingIndicator />
    </div>
    <InvitationList
      v-else
      :invitations="invitations"
      :busy-id="busyId"
      @revoke="emit('revoke', $event)"
    />
  </section>
</template>

<script setup lang="ts">
import type { VenueRole } from "../composables/useVenueTeam";
import { compactMessagePt } from "~/utils/primevue-message";
import InviteEmployeeForm from "./InviteEmployeeForm.vue";
import InvitationList from "./InvitationList.vue";

type InviteRole = VenueRole | "CHEF_BARTENDER";
type PendingInvitation = {
  id: string;
  email: string;
  role: InviteRole;
  expiresAt: string;
  canRevoke: boolean;
  scope: "venue" | "company";
};

defineProps<{
  allowVenueInvites: boolean;
  allowBarManager: boolean;
  allowChefBartender: boolean;
  busy: boolean;
  busyId: string;
  error: string;
  chefError: boolean;
  loading: boolean;
  invitations: PendingInvitation[];
}>();
const emit = defineEmits<{
  submit: [email: string, role: InviteRole];
  revoke: [invitation: PendingInvitation];
}>();

function submit(email: string, role: InviteRole): void {
  emit("submit", email, role);
}
</script>
