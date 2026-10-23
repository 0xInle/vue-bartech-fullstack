<template>
  <section class="space-y-2">
    <h3 class="text-sm font-semibold">Ожидают ответа</h3>
    <p v-if="!invitations.length" class="mt-3 text-sm text-color-secondary">
      Нет приглашенных сотрудников
    </p>
    <ul v-else class="divide-y divide-surface overflow-hidden rounded-lg border border-surface">
      <li v-for="invitation in invitations" :key="invitation.id" class="space-y-2 p-3 text-sm">
        <div class="flex items-center gap-2">
          <p class="min-w-0 flex-1 truncate font-medium">{{ invitation.email }}</p>
          <Button
            v-if="invitation.canRevoke"
            icon="pi pi-times"
            aria-label="Отозвать приглашение"
            severity="secondary"
            variant="text"
            size="small"
            :disabled="busyId === invitation.id"
            :loading="busyId === invitation.id"
            @click="$emit('revoke', invitation)"
          />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Tag :value="roleLabel(invitation.role)" severity="contrast" :pt="compactTagPt" />
          <div class="ml-auto flex items-center gap-2">
            <Tag
              :value="`до ${formatDate(invitation.expiresAt)}`"
              severity="secondary"
              :pt="compactTagPt"
            />
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { VenueRole } from "../composables/useVenueTeam";

type InviteRole = VenueRole | "CHEF_BARTENDER";
type PendingInvitation = {
  id: string;
  email: string;
  role: InviteRole;
  expiresAt: string;
  canRevoke: boolean;
  scope: "venue" | "company";
};

defineProps<{ invitations: PendingInvitation[]; busyId: string }>();
defineEmits<{ revoke: [invitation: PendingInvitation] }>();

const compactTagPt = {
  root: {
    style: { fontSize: "0.6875rem", fontWeight: "500", padding: "0.125rem 0.375rem" },
  },
};

function roleLabel(role: InviteRole): string {
  return {
    BARTENDER: "Бармен",
    BARBACK: "Барбек",
    TRAINEE: "Стажёр",
    SENIOR_BARTENDER: "Старший бармен",
    BAR_MANAGER: "Бар-менеджер",
    CHEF_BARTENDER: "Шеф-бармен",
  }[role];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}
</script>
