<template>
  <section class="space-y-4">
    <div v-if="error || chefError || newVenueError" class="space-y-3 p-1">
      <Message v-if="error" severity="error" :closable="false" :pt="compactMessagePt">{{
        error
      }}</Message>
      <Message v-if="chefError" severity="error" :closable="false" :pt="compactMessagePt">
        Не удалось загрузить приглашения шеф-барменов.
      </Message>
      <Message v-if="newVenueError" severity="error" :closable="false" :pt="compactMessagePt">
        Не удалось загрузить приглашения для новых заведений.
      </Message>
    </div>
    <InviteEmployeeForm
      :allow-venue-invites="allowVenueInvites"
      :allow-bar-manager="allowBarManager"
      :allow-chef-bartender="allowChefBartender"
      :allow-new-venue-invite="allowNewVenueInvite"
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
  scope: "venue" | "company" | "newVenue";
};

defineProps<{
  allowVenueInvites: boolean;
  allowBarManager: boolean;
  allowChefBartender: boolean;
  allowNewVenueInvite: boolean;
  busy: boolean;
  busyId: string;
  error: string;
  chefError: boolean;
  newVenueError: boolean;
  loading: boolean;
  invitations: PendingInvitation[];
}>();
const emit = defineEmits<{
  submit: [email: string, role: InviteRole, newVenue: boolean];
  revoke: [invitation: PendingInvitation];
}>();

function submit(email: string, role: InviteRole, newVenue: boolean): void {
  emit("submit", email, role, newVenue);
}
</script>
