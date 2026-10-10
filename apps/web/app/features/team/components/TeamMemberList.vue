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
        </div>
        <Tag :value="roleLabel(member.role)" severity="secondary" />
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { TeamMember, VenueRole } from "../composables/useVenueTeam";

defineProps<{ members: TeamMember[] }>();

function roleLabel(role: VenueRole): string {
  return {
    BARTENDER: "Бармен",
    SENIOR_BARTENDER: "Старший бармен",
    BAR_MANAGER: "Бар-менеджер",
  }[role];
}
</script>
