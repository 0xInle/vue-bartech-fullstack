<template>
  <section class="w-full">
    <header class="mb-5 flex items-center justify-between gap-3">
      <h1 class="text-xl font-semibold tracking-tight">История действий</h1>
    </header>

    <div class="mb-5 flex flex-col gap-3 pt-2 md:flex-row md:flex-nowrap md:items-end">
      <FloatLabel variant="on" class="w-full min-w-0 md:w-64 md:flex-none">
        <DatePicker
          v-model="dateRange"
          input-id="history-date-range"
          selection-mode="range"
          date-format="dd.mm.yy"
          :manual-input="false"
          size="small"
          show-icon
          icon-display="input"
          show-button-bar
          show-clear
          class="w-full"
          @update:model-value="updateDateRange"
        />
        <label for="history-date-range" class="text-xs">Период</label>
      </FloatLabel>
      <FloatLabel variant="on" class="w-full min-w-0 md:flex-1">
        <Select
          v-model="eventType"
          input-id="history-event-filter"
          :options="eventOptions"
          option-label="label"
          option-value="value"
          size="small"
          class="w-full"
          show-clear
          @update:model-value="applyFilters"
        />
        <label for="history-event-filter" class="text-xs">Действие</label>
      </FloatLabel>
      <FloatLabel variant="on" class="w-full min-w-0 md:flex-1">
        <Select
          v-model="actorId"
          input-id="history-actor-filter"
          :options="actorOptions"
          option-label="name"
          option-value="id"
          size="small"
          class="w-full"
          show-clear
          @update:model-value="applyFilters"
        />
        <label for="history-actor-filter" class="text-xs">Сотрудник</label>
      </FloatLabel>
    </div>

    <LoadingIndicator v-if="historyQuery.isLoading.value" screen />
    <Message
      v-else-if="historyQuery.isError.value"
      severity="error"
      :closable="false"
      :pt="compactMessagePt"
    >
      Историю не удалось загрузить. Проверьте доступ к рабочему пространству и повторите попытку.
      <Button label="Повторить" size="small" text @click="historyQuery.refetch()" />
    </Message>
    <Message
      v-else-if="!items.length"
      severity="secondary"
      :closable="false"
      :pt="compactMessagePt"
    >
      За выбранный период действий не найдено.
    </Message>
    <DataTable
      v-else
      v-model:expanded-rows="expandedRows"
      :value="items"
      data-key="id"
      size="small"
      row-hover
      class="history-table text-sm"
      :pt="historyTablePt"
      @row-click="onRowClick"
    >
      <Column
        field="createdAt"
        header="Дата изменения"
        :style="{ width: '1%', whiteSpace: 'nowrap' }"
      >
        <template #body="{ data }">{{ formatDate(data.createdAt) }}</template>
      </Column>
      <Column
        header=""
        style="width: 30px; min-width: 30px; max-width: 30px"
        header-class="!p-0"
        body-class="!p-0"
      />
      <Column field="eventType" header="Действие" :style="{ width: '1%', whiteSpace: 'nowrap' }">
        <template #body="{ data }">
          <div class="flex items-center gap-1">
            <span>{{ eventSummary(data) }}</span>
          </div>
        </template>
      </Column>
      <Column
        header=""
        style="width: 30px; min-width: 30px; max-width: 30px"
        header-class="!p-0"
        body-class="!p-0"
      />
      <Column field="actorName" header="Сотрудник" :style="{ width: '1%', whiteSpace: 'nowrap' }">
        <template #body="{ data }">{{ data.actorName ?? "Аккаунт недоступен" }}</template>
      </Column>
      <template #expansion="{ data }">
        <div class="space-y-1 px-2 py-2 text-sm">
          <p v-for="detail in data.details" :key="detail">
            <template v-if="catalogMatchNames(detail)">
              Ингредиент:
              <strong class="font-semibold">{{ catalogMatchNames(detail)?.local }}</strong>
              →
              <strong class="font-semibold">{{ catalogMatchNames(detail)?.global }}</strong>
            </template>
            <template v-else>{{ detail }}</template>
          </p>
        </div>
      </template>
    </DataTable>

    <Paginator
      v-if="totalRecords > pageSize"
      :first="first"
      :rows="pageSize"
      :total-records="totalRecords"
      :rows-per-page-options="[10, 20, 30]"
      :pt="paginatorPt"
      class="mt-3"
      @page="handlePageChange"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onActivated, ref, watch } from "vue";
import type { AuditControllerListParams } from "@bartech/api-client";
import { compactMessagePt } from "~/utils/primevue-message";
import { useAuditHistory, type AuditEvent } from "../composables/useAuditHistory";

const props = defineProps<{ companyId: string; venueId: string; scope: "company" | "venue" }>();
const pageSize = ref(20);
const route = useRoute();
const router = useRouter();
const from = ref(queryString(route.query.from));
const to = ref(queryString(route.query.to));
const dateRange = ref<Array<Date | null> | null>(createDateRange(from.value, to.value));
const eventType = ref(queryString(route.query.eventType) || undefined);
const actorId = ref(queryString(route.query.actorId) || undefined);
const currentPage = computed(() => {
  const parsed = Number.parseInt(String(route.query.page ?? "1"), 10);
  return Math.max(Number.isFinite(parsed) ? parsed : 1, 1);
});
const filters = computed<AuditControllerListParams>(() => ({
  from: dateBoundary(from.value, false),
  to: dateBoundary(to.value, true),
  eventType: eventType.value,
  actorId: actorId.value,
  entityType: typeof route.query.entityType === "string" ? route.query.entityType : undefined,
  entityId: typeof route.query.entityId === "string" ? route.query.entityId : undefined,
  page: currentPage.value,
  limit: pageSize.value,
}));
const authorFilters = computed(() => ({
  from: filters.value.from,
  to: filters.value.to,
  eventType: filters.value.eventType,
  entityType: filters.value.entityType,
  entityId: filters.value.entityId,
}));
const { historyQuery, authorsQuery } = useAuditHistory(
  () => props.companyId,
  () => props.venueId,
  filters,
  authorFilters,
);
onActivated(() => {
  void historyQuery.refetch();
  void authorsQuery.refetch();
});
const items = computed(() => historyQuery.data.value?.items ?? []);
const totalRecords = computed(() => historyQuery.data.value?.totalRecords ?? 0);
const totalPages = computed(() => Math.max(1, Math.ceil(totalRecords.value / pageSize.value)));
const first = computed(() => (currentPage.value - 1) * pageSize.value);
watch(
  () => historyQuery.data.value,
  (page) => {
    if (page && currentPage.value > totalPages.value) {
      void router.replace({
        query: {
          ...route.query,
          page: totalPages.value > 1 ? String(totalPages.value) : undefined,
        },
      });
    }
  },
);
const commonEventOptions = [
  { label: "Создание", value: "product.created" },
  { label: "Изменение", value: "product.updated" },
  { label: "Архивирование", value: "product.archived" },
  { label: "Восстановление", value: "product.restored" },
  { label: "Удаление", value: "product.permanently_deleted" },
  { label: "Выдача доступа техподдержке", value: "support.access_granted" },
  { label: "Отзыв доступа техподдержке", value: "support.access_revoked" },
  { label: "Сотрудник техподдержки подключился", value: "service_access.started" },
  { label: "Сотрудник техподдержки завершил сессию", value: "service_access.ended" },
  { label: "Изменение должности сотрудника", value: "membership.role_changed" },
  { label: "Изменение прав сотрудника", value: "membership.permission_overrides_changed" },
  { label: "Удаление сотрудника", value: "membership.ended" },
  {
    label: "Завершение временной ответственности сотрудника",
    value: "temporary_responsibility.ended",
  },
  { label: "Создание приглашения", value: "invitation.created" },
  { label: "Отзыв приглашения", value: "invitation.revoked" },
  { label: "Истечение приглашения", value: "invitation.expired" },
  { label: "Принятие приглашения", value: "invitation.completed" },
  { label: "Сопоставление ингредиента с каталогом", value: "PRODUCT_CATALOG_MATCHED" },
];
const eventOptions = commonEventOptions;
const actorOptions = computed(() => authorsQuery.data.value ?? []);
const expandedRows = ref<Record<string, boolean>>({});

watch(
  () => ({
    loaded: authorsQuery.isSuccess.value,
    selectedActorId: actorId.value,
    authors: actorOptions.value,
  }),
  ({ loaded, selectedActorId, authors }) => {
    if (!loaded || !selectedActorId) return;
    if (authors.some((author) => author.id === selectedActorId)) return;
    actorId.value = undefined;
    void applyFilters();
  },
);

watch(
  [
    () => route.query.from,
    () => route.query.to,
    () => route.query.eventType,
    () => route.query.actorId,
  ],
  () => {
    from.value = queryString(route.query.from);
    to.value = queryString(route.query.to);
    dateRange.value = createDateRange(from.value, to.value);
    eventType.value = queryString(route.query.eventType) || undefined;
    actorId.value = queryString(route.query.actorId) || undefined;
  },
);

async function applyFilters(): Promise<void> {
  await router.replace({
    query: {
      ...route.query,
      from: from.value || undefined,
      to: to.value || undefined,
      eventType: eventType.value,
      actorId: actorId.value,
      page: undefined,
    },
  });
}

function updateDateRange(value: Date | Date[] | Array<Date | null> | null | undefined): void {
  dateRange.value = Array.isArray(value) ? value : null;
  if (!Array.isArray(value) || !value.length) {
    from.value = "";
    to.value = "";
    void applyFilters();
    return;
  }
  if (value[0] && value[1]) {
    from.value = formatQueryDate(value[0]);
    to.value = formatQueryDate(value[1]);
    void applyFilters();
  }
}

function handlePageChange(event: { page: number; rows: number }): void {
  pageSize.value = event.rows;
  void router.replace({
    query: {
      ...route.query,
      page: String(event.page + 1),
    },
  });
}

function toggleDetails(id: string): void {
  const nextExpandedRows = { ...expandedRows.value };
  if (nextExpandedRows[id]) delete nextExpandedRows[id];
  else nextExpandedRows[id] = true;
  expandedRows.value = nextExpandedRows;
}

function onRowClick(event: { data: AuditEvent }): void {
  if (event.data.details.length) toggleDetails(event.data.id);
}

function eventSummary(event: AuditEvent): string {
  const summary =
    event.eventType === "product.permanently_deleted"
      ? event.summary.replace(/^Безвозвратно удалён(а)?/u, (_match, feminine: string) =>
          feminine ? "Удалена" : "Удалён",
        )
      : event.summary;
  return summary.replace(/^\p{Ll}/u, (letter) => letter.toLocaleUpperCase("ru-RU"));
}

function catalogMatchNames(detail: string): { local: string; global: string } | null {
  const match = /^Ингредиент: (.+) → (.+)$/u.exec(detail);
  return match ? { local: match[1]!, global: match[2]! } : null;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function queryString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function createDateRange(start: string, end: string): Date[] | null {
  const startDate = parseQueryDate(start);
  const endDate = parseQueryDate(end);
  return startDate && endDate ? [startDate, endDate] : null;
}

function parseQueryDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) &&
    date.getMonth() === Number(match[2]) - 1 &&
    date.getDate() === Number(match[3])
    ? date
    : null;
}

function formatQueryDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateBoundary(value: string, endOfDay: boolean): string | undefined {
  const date = parseQueryDate(value);
  if (!date) return undefined;
  date.setHours(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return date.toISOString();
}

const historyTablePt = {
  root: {
    style: {
      "--p-datatable-border-color": "var(--p-content-border-color)",
      "--p-datatable-header-cell-background": "transparent",
      "--p-datatable-row-background": "transparent",
      "--p-datatable-row-hover-background":
        "color-mix(in srgb, var(--p-primary-100) 70%, var(--p-content-background))",
      border: "1px solid var(--p-datatable-border-color)",
      borderRadius: "var(--p-content-border-radius)",
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
const paginatorPt = {
  root: { class: "gap-1 border-0 bg-transparent p-0 text-sm" },
  first: { class: "!h-8 !min-w-8 text-xs" },
  prev: { class: "!h-8 !min-w-8 text-xs" },
  page: { class: "!h-8 !min-w-8 text-xs" },
  next: { class: "!h-8 !min-w-8 text-xs" },
  last: { class: "!h-8 !min-w-8 text-xs" },
  pcRowPerPageDropdown: {
    root: { class: "!h-8" },
    label: { class: "!text-xs" },
  },
};
</script>

<style scoped>
:deep(.history-table .p-datatable-tbody > tr:last-child > td) {
  border-bottom: 0;
}

:deep(.history-table .p-datatable-thead > tr:first-child > th:first-child) {
  border-top-left-radius: var(--p-border-radius-md);
}

:deep(.history-table .p-datatable-thead > tr:first-child > th:last-child) {
  border-top-right-radius: var(--p-border-radius-md);
}

:deep(.history-table .p-datatable-tbody > tr:last-child > td:first-child) {
  border-bottom-left-radius: var(--p-border-radius-md);
}

:deep(.history-table .p-datatable-tbody > tr:last-child > td:last-child) {
  border-bottom-right-radius: var(--p-border-radius-md);
}
</style>
