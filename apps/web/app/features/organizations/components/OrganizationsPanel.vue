<template>
  <section>
    <h2 class="text-base mt-2 font-medium text-color-secondary">Рабочие пространства:</h2>
    <ul v-if="workplaces.length" class="mt-2 space-y-3">
      <li v-for="workplace in workplaces" :key="workplace.venue.id">
        <NuxtLink
          :to="`/app/companies/${workplace.company.id}/venues/${workplace.venue.id}`"
          class="workspace-link block rounded-xl border p-4 transition-colors"
        >
          <span class="brand-eyebrow block text-xs font-semibold uppercase">
            {{ workplace.venue.name }}
          </span>
          <span class="brand-description mt-1 block text-xs">{{ workplace.company.name }}</span>
        </NuxtLink>
      </li>
    </ul>
    <section v-if="companies.length" :class="workplaces.length ? 'mt-6' : 'mt-5'">
      <h3 class="text-sm font-semibold">Компании без заведений</h3>
      <ul class="mt-3 space-y-3">
        <li v-for="company in companies" :key="company.id">
          <NuxtLink
            :to="`/app/companies/${company.id}`"
            class="workspace-link block rounded-xl border p-4 transition-colors"
          >
            <span class="block font-semibold">{{ company.name }}</span>
            <span class="brand-description mt-1 block text-sm">Добавить заведение</span>
          </NuxtLink>
        </li>
      </ul>
    </section>
    <p v-if="!workplaces.length && !companies.length" class="brand-description mt-3 text-sm">
      В аккаунте пока нет доступных заведений или компаний.
    </p>
  </section>
</template>

<script setup lang="ts">
import type { CompanySummary, Workspace } from "~/types/user-workspaces";

defineProps<{
  workplaces: Workspace[];
  companies: CompanySummary[];
}>();
</script>
