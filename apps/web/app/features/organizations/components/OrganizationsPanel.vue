<template>
  <section>
    <h2 class="mt-2 text-2xl font-semibold">Ваши рабочие пространства</h2>
    <ul v-if="workplaces.length" class="mt-5 space-y-3">
      <li v-for="workplace in workplaces" :key="workplace.venue.id">
        <NuxtLink
          :to="`/app/companies/${workplace.company.id}/venues/${workplace.venue.id}`"
          class="workspace-link block rounded-xl border p-4 transition-colors"
        >
          <span class="block font-semibold">{{ workplace.venue.name }}</span>
          <span class="brand-description mt-1 block text-sm">{{ workplace.company.name }}</span>
        </NuxtLink>
      </li>
    </ul>
    <p v-else class="brand-description mt-3 text-sm">В аккаунте пока нет заведений.</p>
  </section>
</template>

<script setup lang="ts">
import type { Workspace } from "~/types/user-workspaces";

defineProps<{
  workplaces: Workspace[];
}>();
</script>
