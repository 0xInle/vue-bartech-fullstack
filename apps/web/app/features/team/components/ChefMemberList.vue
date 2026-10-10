<template>
  <section>
    <h2 class="text-lg font-semibold">Шеф-бармены компании</h2>
    <p v-if="!members.length" class="mt-3 text-sm text-zinc-500">
      В компании пока нет шеф-барменов.
    </p>
    <ul v-else class="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
      <li v-for="member in members" :key="member.id" class="p-3">
        <p class="text-sm font-medium">{{ member.fullName }}</p>
        <p class="text-xs text-zinc-500">{{ member.email }}</p>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { CompanyChefMember } from "../composables/useCompanyChefTeam";

defineProps<{ members: CompanyChefMember[] }>();
</script>
