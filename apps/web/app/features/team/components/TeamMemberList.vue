<template>
  <section>
    <h2 class="text-lg font-semibold">Сотрудники</h2>
    <ul class="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
      <li
        v-for="member in members"
        :key="member.id"
        class="flex flex-wrap justify-between gap-2 p-3"
      >
        <div class="min-w-0">
          <p class="truncate text-sm font-medium">{{ member.fullName }}</p>
          <p class="truncate text-xs text-zinc-500">{{ member.email }}</p>
          <p v-if="canManageTeam && member.isCurrentUser" class="mt-1 text-xs text-color-secondary">
            Свою роль можно изменить только при выходе из заведения.
          </p>
          <p
            v-else-if="
              canManageTeam && member.role === 'BAR_MANAGER' && !member.availableRoles.length
            "
            class="mt-1 text-xs text-color-secondary"
          >
            Временный ответственный не может менять должность бар-менеджера.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <Tag :value="roleLabel(member.role)" severity="secondary" />
          <Button
            v-if="canManage(member)"
            label="Настроить"
            severity="secondary"
            variant="outlined"
            size="small"
            @click="$emit('edit', member)"
          />
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { TeamMember, VenueRole } from "../composables/useVenueTeam";

defineProps<{ members: TeamMember[]; canManageTeam: boolean }>();
defineEmits<{ edit: [member: TeamMember] }>();

function canManage(member: TeamMember): boolean {
  return member.availableRoles.length > 0 || member.canManageDelegatedPermissions;
}

function roleLabel(role: VenueRole): string {
  return {
    BARTENDER: "Бармен",
    SENIOR_BARTENDER: "Старший бармен",
    BAR_MANAGER: "Бар-менеджер",
  }[role];
}
</script>
