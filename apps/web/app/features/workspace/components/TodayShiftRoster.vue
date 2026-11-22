<template>
  <section
    class="w-full min-w-0 rounded-lg border border-[var(--p-content-border-color)] p-2"
    :aria-labelledby="headingId"
  >
    <header class="flex items-center justify-between gap-2">
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <i class="pi pi-calendar text-sm text-primary" aria-hidden="true" />
        <h2 :id="headingId" class="text-sm font-semibold">{{ title }}</h2>
        <Divider layout="vertical" class="!mx-0 !my-0 self-stretch" />
        <div class="flex items-center gap-1">
          <Button
            icon="pi pi-chevron-left"
            aria-label="Предыдущий день"
            size="small"
            severity="secondary"
            variant="text"
            :disabled="!canGoPrevious"
            class="workspace-action-icon-button shrink-0"
            @click="previousDay"
          />
          <span class="whitespace-nowrap text-sm text-color-secondary">{{ formattedDate }}</span>
          <Button
            icon="pi pi-chevron-right"
            aria-label="Следующий день"
            size="small"
            severity="secondary"
            variant="text"
            :disabled="!canGoNext"
            class="workspace-action-icon-button shrink-0"
            @click="nextDay"
          />
        </div>
        <span v-if="!isLoading && !isError" class="ml-auto text-sm text-color-secondary">
          {{ shifts.length }} {{ employeeWord(shifts.length) }}
        </span>
      </div>
      <Button
        :icon="collapsed ? 'pi pi-chevron-down' : 'pi pi-chevron-up'"
        :aria-label="collapsed ? 'Развернуть смену' : 'Свернуть смену'"
        :aria-expanded="!collapsed"
        size="small"
        severity="secondary"
        variant="text"
        class="workspace-action-icon-button shrink-0"
        @click="collapsed = !collapsed"
      />
    </header>

    <Transition name="dashboard-collapse">
      <div v-if="!collapsed" class="dashboard-collapse">
        <div class="space-y-2">
          <div v-if="isError" class="p-1">
            <Message severity="error" :closable="false" :pt="rosterMessagePt">
              Не удалось загрузить смены. Обновите страницу и попробуйте ещё раз.
            </Message>
          </div>
          <LoadingIndicator v-else-if="isLoading" />
          <p v-else-if="!shifts.length" class="text-xs text-color-secondary">
            {{ isToday ? "На сегодня смены не назначены." : "На этот день смены не назначены." }}
          </p>
          <DataTable
            v-else
            :value="shifts"
            data-key="membershipId"
            size="small"
            :show-headers="false"
            class="today-shift-roster-table text-sm"
            :pt="tablePt"
          >
            <Column field="fullName" header="Сотрудник" body-class="whitespace-nowrap" />
            <Column field="roleLabel" header="Роль" body-class="whitespace-nowrap" />
            <Column field="shiftName" header="Смена" body-class="whitespace-nowrap">
              <template #body="{ data }">
                <Tag :value="data.shiftName" severity="secondary" :pt="compactTagPt" />
              </template>
            </Column>
            <Column
              field="time"
              header="Время"
              :style="{ width: '1%', whiteSpace: 'nowrap' }"
              body-class="whitespace-nowrap tabular-nums"
            />
          </DataTable>
        </div>
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import { useTodayShiftRoster } from "~/features/schedule/composables/useTodayShiftRoster";

const props = defineProps<{ companyId: string; venueId: string }>();
const headingId = useId();
const collapsed = ref(false);
const { date, isToday, title, canGoPrevious, canGoNext, monthQuery, nextDay, previousDay, shifts } =
  useTodayShiftRoster(toRef(props, "companyId"), toRef(props, "venueId"));
const formattedDate = computed(() =>
  new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${date.value}T00:00:00`),
  ),
);
const isLoading = computed(() => monthQuery.isPending.value || monthQuery.isFetching.value);
const isError = computed(() => monthQuery.isError.value);
const rosterMessagePt = {
  text: { style: { fontSize: "0.875rem", fontWeight: "500", lineHeight: "1.25rem" } },
};

const tablePt = {
  root: {
    style: {
      "--p-datatable-border-color": "var(--p-content-border-color)",
    },
  },
  headerCell: {
    class: "whitespace-nowrap px-1 py-0.5 text-sm",
    style: {
      borderTop: "0",
      borderRight: "0",
      borderLeft: "0",
      borderBottom: "1px solid var(--p-content-border-color)",
      fontWeight: "400",
    },
  },
  bodyCell: {
    class: "px-1 py-0.5 text-sm",
    style: {
      borderTop: "0",
      borderRight: "0",
      borderLeft: "0",
      borderBottom: "1px solid var(--p-content-border-color)",
    },
  },
};
const compactTagPt = {
  root: {
    style: { fontSize: "0.75rem", padding: "0.125rem 0.375rem" },
  },
  label: { style: { fontWeight: "400" } },
};

function employeeWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "сотрудник";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "сотрудника";
  return "сотрудников";
}
</script>

<style scoped>
:deep(.today-shift-roster-table .p-datatable-tbody > tr:last-child > td) {
  border-bottom: 0;
}

:deep(.today-shift-roster-table .p-datatable-thead > tr:first-child > th:first-child) {
  border-top-left-radius: var(--p-border-radius-md);
}

:deep(.today-shift-roster-table .p-datatable-thead > tr:first-child > th:last-child) {
  border-top-right-radius: var(--p-border-radius-md);
}

:deep(.today-shift-roster-table .p-datatable-tbody > tr:last-child > td:first-child) {
  border-bottom-left-radius: var(--p-border-radius-md);
}

:deep(.today-shift-roster-table .p-datatable-tbody > tr:last-child > td:last-child) {
  border-bottom-right-radius: var(--p-border-radius-md);
}
</style>
