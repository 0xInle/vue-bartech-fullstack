<template>
  <section class="mx-auto max-w-5xl">
    <header class="mb-6">
      <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Управление</p>
      <h1 class="mt-2 text-2xl font-semibold tracking-tight">История действий</h1>
      <p class="mt-2 text-sm text-color-secondary">
        Значимые действия в доступном рабочем пространстве.
      </p>
    </header>

    <div class="mb-5 grid gap-3 rounded-lg border border-surface p-4 sm:grid-cols-3">
      <label class="flex flex-col gap-1 text-sm">
        <span>С даты</span>
        <InputText v-model="from" type="date" size="small" @change="applyFilters" />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span>По дату</span>
        <InputText v-model="to" type="date" size="small" @change="applyFilters" />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span>Действие</span>
        <Select
          v-model="eventType"
          :options="eventOptions"
          option-label="label"
          option-value="value"
          size="small"
          placeholder="Все действия"
          show-clear
          @update:model-value="applyFilters"
        />
      </label>
      <label class="flex flex-col gap-1 text-sm sm:col-span-3">
        <span>Сотрудник</span>
        <Select
          v-model="actorId"
          :options="actorOptions"
          option-label="name"
          option-value="id"
          size="small"
          placeholder="Все сотрудники"
          show-clear
          @update:model-value="applyFilters"
        />
      </label>
    </div>

    <Message v-if="historyQuery.isLoading.value" severity="info" :closable="false">
      Загружаем историю…
    </Message>
    <Message v-else-if="historyQuery.isError.value" severity="error" :closable="false">
      Историю не удалось загрузить. Проверьте доступ к рабочему пространству и повторите попытку.
      <Button label="Повторить" size="small" text @click="historyQuery.refetch()" />
    </Message>
    <Message v-else-if="!items.length" severity="secondary" :closable="false">
      За выбранный период действий не найдено.
    </Message>
    <div v-else class="divide-y divide-surface rounded-lg border border-surface">
      <article v-for="item in items" :key="item.id" class="p-4">
        <p class="font-medium">
          {{ item.actorName ?? "Аккаунт недоступен" }} · {{ eventLabel(item.eventType) }}
        </p>
        <p class="mt-1 text-sm text-color-secondary">
          {{ formatDate(item.createdAt)
          }}<span v-if="item.entityName"> · {{ item.entityName }}</span>
        </p>
      </article>
    </div>
    <div v-if="historyQuery.data.value?.nextCursor" class="mt-4 flex justify-center">
      <Button
        label="Загрузить ещё"
        icon="pi pi-chevron-down"
        size="small"
        outlined
        @click="loadNext"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { AuditControllerListParams } from "@bartech/api-client";
import { useAuditHistory, type AuditEvent } from "../composables/useAuditHistory";

const props = defineProps<{ companyId: string; venueId: string }>();
const route = useRoute();
const router = useRouter();
const from = ref(typeof route.query.from === "string" ? route.query.from : "");
const to = ref(typeof route.query.to === "string" ? route.query.to : "");
const eventType = ref(
  typeof route.query.eventType === "string" ? route.query.eventType : undefined,
);
const actorId = ref(typeof route.query.actorId === "string" ? route.query.actorId : undefined);
const cursor = ref(typeof route.query.cursor === "string" ? route.query.cursor : undefined);
const filters = computed<AuditControllerListParams>(() => ({
  from: from.value ? new Date(`${from.value}T00:00:00.000Z`).toISOString() : undefined,
  to: to.value ? new Date(`${to.value}T23:59:59.999Z`).toISOString() : undefined,
  eventType: eventType.value,
  actorId: actorId.value,
  entityType: typeof route.query.entityType === "string" ? route.query.entityType : undefined,
  entityId: typeof route.query.entityId === "string" ? route.query.entityId : undefined,
  cursor: cursor.value,
  limit: 30,
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
const pages = ref<AuditEvent[]>([]);
const items = computed(() => pages.value);
const eventOptions = [
  { label: "Создание", value: "product.created" },
  { label: "Изменение", value: "product.updated" },
  { label: "Архивирование", value: "product.archived" },
  { label: "Восстановление", value: "product.restored" },
  { label: "Запрос выгрузки", value: "export.requested" },
  { label: "Выгрузка готова", value: "export.completed" },
  { label: "Ошибка выгрузки", value: "export.failed" },
  { label: "Изменение должности", value: "membership.role_changed" },
  { label: "Изменение прав", value: "membership.delegated_permissions_changed" },
  { label: "Завершение временной ответственности", value: "temporary_responsibility.ended" },
  { label: "Создание приглашения", value: "invitation.created" },
  { label: "Отзыв приглашения", value: "invitation.revoked" },
  { label: "Истечение приглашения", value: "invitation.expired" },
  { label: "Принятие приглашения", value: "invitation.completed" },
  { label: "Создание заведения", value: "venue.created" },
  { label: "Закрытие заведения", value: "venue.closed" },
  { label: "Закрытие компании запущено", value: "company.closure_started" },
  { label: "Закрытие компании отменено", value: "company.closure_cancelled" },
  { label: "Компания закрыта", value: "company.closed" },
  { label: "Сопоставление каталога", value: "PRODUCT_CATALOG_MATCHED" },
];
const actorOptions = computed(() => authorsQuery.data.value ?? []);

watch(
  () => [
    filters.value.from,
    filters.value.to,
    filters.value.eventType,
    filters.value.actorId,
    filters.value.entityType,
    filters.value.entityId,
  ],
  () => {
    pages.value = [];
  },
);

watch(
  () => historyQuery.data.value,
  (page) => {
    if (!page) return;
    const knownIds = new Set(pages.value.map((item) => item.id));
    pages.value.push(...page.items.filter((item) => !knownIds.has(item.id)));
  },
  { immediate: true },
);

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
  () => [
    route.query.from,
    route.query.to,
    route.query.eventType,
    route.query.actorId,
    route.query.cursor,
  ],
  () => {
    from.value = typeof route.query.from === "string" ? route.query.from : "";
    to.value = typeof route.query.to === "string" ? route.query.to : "";
    eventType.value = typeof route.query.eventType === "string" ? route.query.eventType : undefined;
    actorId.value = typeof route.query.actorId === "string" ? route.query.actorId : undefined;
    cursor.value = typeof route.query.cursor === "string" ? route.query.cursor : undefined;
  },
);

async function applyFilters(): Promise<void> {
  cursor.value = undefined;
  await router.replace({
    query: {
      ...route.query,
      from: from.value || undefined,
      to: to.value || undefined,
      eventType: eventType.value,
      actorId: actorId.value,
      cursor: undefined,
    },
  });
}

async function loadNext(): Promise<void> {
  cursor.value = historyQuery.data.value?.nextCursor ?? undefined;
  await router.replace({ query: { ...route.query, cursor: cursor.value } });
}

function eventLabel(value: string): string {
  return eventOptions.find((option) => option.value === value)?.label ?? "Выполнил действие";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
</script>
