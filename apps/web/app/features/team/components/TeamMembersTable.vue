<template>
  <DataTable
    :value="members"
    data-key="id"
    size="small"
    scrollable
    scroll-height="flex"
    row-hover
    class="team-members-table h-full text-sm"
    :pt="teamMembersTablePt"
    @row-click="onRowClick"
  >
    <Column field="fullName" header="Сотрудник" body-class="whitespace-nowrap">
      <template #body="{ data }">
        <span class="whitespace-nowrap text-sm font-normal">{{ data.fullName }}</span>
      </template>
    </Column>
    <Column
      field="role"
      header="Должность"
      :style="{ width: '1%', whiteSpace: 'nowrap' }"
      header-class="whitespace-nowrap text-right"
      body-class="whitespace-nowrap text-right"
    >
      <template #body="{ data }">
        <Tag :value="roleLabel(data.role)" severity="secondary" :pt="compactTagPt" />
      </template>
    </Column>
  </DataTable>
</template>

<script setup lang="ts">
import type { TeamMember, VenueRole } from "../composables/useVenueTeam";

type TeamMemberRow = TeamMember;
const props = defineProps<{ members: TeamMemberRow[] }>();
const emit = defineEmits<{ edit: [member: TeamMemberRow] }>();
const teamMembersTablePt = {
  root: {
    style: {
      "--p-datatable-row-hover-background":
        "color-mix(in srgb, var(--p-primary-100) 70%, var(--p-content-background))",
      "--p-datatable-border-color": "var(--p-content-border-color)",
    },
  },
  headerCell: {
    class: "whitespace-nowrap px-1 py-1 text-sm",
    style: {
      borderTop: "0",
      borderRight: "0",
      borderLeft: "0",
      borderBottom: "1px solid var(--p-content-border-color)",
      fontWeight: "400",
    },
  },
  bodyCell: {
    class: "px-1 py-1 text-sm",
    style: {
      borderTop: "0",
      borderRight: "0",
      borderLeft: "0",
      borderBottom: "1px solid var(--p-content-border-color)",
    },
  },
  bodyRow: { class: "cursor-pointer" },
};

function onRowClick(event: { data: TeamMemberRow }): void {
  const member = props.members.find(({ id }) => id === event.data.id);
  if (member) emit("edit", member);
}

const compactTagPt = {
  root: {
    style: { fontSize: "0.75rem", padding: "0.125rem 0.375rem" },
  },
  label: { style: { fontWeight: "400" } },
};
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
  border-bottom: 0;
}

:deep(.team-members-table .p-datatable-thead > tr:first-child > th:first-child) {
  border-top-left-radius: var(--p-border-radius-md);
}

:deep(.team-members-table .p-datatable-thead > tr:first-child > th:last-child) {
  border-top-right-radius: var(--p-border-radius-md);
}

:deep(.team-members-table .p-datatable-tbody > tr:last-child > td:first-child) {
  border-bottom-left-radius: var(--p-border-radius-md);
}

:deep(.team-members-table .p-datatable-tbody > tr:last-child > td:last-child) {
  border-bottom-right-radius: var(--p-border-radius-md);
}
</style>
