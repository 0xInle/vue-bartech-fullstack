<template>
  <section>
    <h2 class="text-lg font-semibold">Ожидают ответа</h2>
    <p v-if="!invitations.length" class="mt-3 text-sm text-zinc-500">Активных приглашений нет.</p>
    <ul v-else class="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
      <li
        v-for="invitation in invitations"
        :key="invitation.id"
        class="flex flex-wrap items-center justify-between gap-3 p-3"
      >
        <div class="min-w-0">
          <p class="truncate text-sm font-medium">{{ invitation.email }}</p>
          <p class="text-xs text-zinc-500">
            {{ roleLabel(invitation.role) }} · до {{ formatDate(invitation.expiresAt) }}
          </p>
        </div>
        <Button
          v-if="invitation.canRevoke"
          label="Отозвать"
          severity="secondary"
          variant="text"
          size="small"
          :disabled="busyId === invitation.id"
          :loading="busyId === invitation.id"
          @click="$emit('revoke', invitation.id)"
        />
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { VenueInvitation, VenueRole } from "../composables/useVenueTeam";

defineProps<{ invitations: VenueInvitation[]; busyId: string }>();
defineEmits<{ revoke: [id: string] }>();

function roleLabel(role: VenueRole): string {
  return {
    BARTENDER: "Бармен",
    SENIOR_BARTENDER: "Старший бармен",
    BAR_MANAGER: "Бар-менеджер",
  }[role];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}
</script>
