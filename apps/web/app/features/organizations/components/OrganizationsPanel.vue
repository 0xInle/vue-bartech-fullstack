<template>
  <section>
    <ul v-if="groups.length" class="space-y-4">
      <li v-for="group in groups" :key="group.company.id">
        <OrganizationCompanyGroup :company="group.company" :workplaces="group.workplaces" />
      </li>
    </ul>
    <p v-else class="brand-description mt-4 text-sm">
      В аккаунте пока нет доступных заведений или компаний.
    </p>
  </section>
</template>

<script setup lang="ts">
import type { CompanySummary, Workspace } from "~/types/user-workspaces";
import OrganizationCompanyGroup from "./OrganizationCompanyGroup.vue";

const props = defineProps<{
  workplaces: Workspace[];
  companies: CompanySummary[];
}>();

const groups = computed(() => {
  const grouped = new Map<string, { company: CompanySummary; workplaces: Workspace[] }>();
  for (const workplace of props.workplaces) {
    const group = grouped.get(workplace.company.id) ?? {
      company: workplace.company,
      workplaces: [],
    };
    group.workplaces.push(workplace);
    grouped.set(workplace.company.id, group);
  }
  for (const company of props.companies) {
    if (!grouped.has(company.id)) grouped.set(company.id, { company, workplaces: [] });
  }
  return [...grouped.values()];
});
</script>
