<template>
  <section>
    <h2 class="text-base font-semibold">Сотрудники</h2>
    <DataTable
      v-model:selection="selectedMember"
      :value="members"
      data-key="id"
      selection-mode="single"
      :meta-key-selection="false"
      size="small"
      class="team-members-table mt-3 text-sm"
      :pt="{
        root: {
          style: {
            '--p-datatable-border-color': 'var(--p-surface-200)',
            '--p-datatable-header-cell-background': 'transparent',
            '--p-datatable-row-background': 'transparent',
            border: '1px solid var(--p-datatable-border-color)',
            borderRadius: 'var(--p-content-border-radius)',
          },
        },
        headerCell: { class: 'text-sm' },
        bodyCell: { class: 'text-sm' },
      }"
      @row-select="onRowSelect"
    >
      <Column field="fullName" header="ФИО">
        <template #body="{ data }">
          <span class="font-medium">{{ data.fullName }}</span>
        </template>
      </Column>
      <Column field="role" header="Должность" style="width: 1%; white-space: nowrap">
        <template #body="{ data }">
          <Tag
            :value="roleLabel(data.role)"
            severity="contrast"
            :pt="{
              root: {
                style: { fontSize: '0.6875rem', fontWeight: '500', padding: '0.125rem 0.375rem' },
              },
            }"
          />
        </template>
      </Column>
    </DataTable>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { TeamMember, VenueRole } from "../composables/useVenueTeam";

defineProps<{ members: TeamMember[] }>();
const emit = defineEmits<{ edit: [member: TeamMember] }>();
const selectedMember = ref<TeamMember | null>(null);

function onRowSelect(event: { data: TeamMember }): void {
  if (canManage(event.data)) emit("edit", event.data);
  selectedMember.value = null;
}

function canManage(member: TeamMember): boolean {
  return member.availableRoles.length > 0 || member.canManageDelegatedPermissions;
}

function roleLabel(role: VenueRole): string {
  return {
    BARTENDER: "Бармен",
    BARBACK: "Барбек",
    TRAINEE: "Стажёр",
    SENIOR_BARTENDER: "Старший бармен",
    BAR_MANAGER: "Бар-менеджер",
  }[role];
}
</script>

<style scoped>
:deep(.team-members-table .p-datatable-tbody > tr:last-child > td) {
  border-block-end-width: 0;
}
</style>
