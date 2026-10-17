<template>
  <main class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <header class="mb-6">
      <NuxtLink to="/internal" class="text-sm font-semibold text-primary"
        >Внутренняя панель</NuxtLink
      >
      <h1 class="mt-4 text-2xl font-semibold tracking-tight">Продуктовая аналитика</h1>
      <p class="mt-2 text-sm text-color-secondary">
        Только агрегированные показатели за выбранный период.
      </p>
    </header>

    <Message v-if="loadingSession" severity="info" :closable="false"
      >Проверяем внутреннюю сессию…</Message
    >
    <Message v-else-if="!authorized" severity="error" :closable="false">
      Нет разрешения на просмотр продуктовой аналитики.
    </Message>
    <template v-else>
      <div class="mb-4 flex flex-wrap gap-2" aria-label="Период аналитики">
        <Button
          v-for="period in periods"
          :key="period.days"
          :label="period.label"
          :severity="days === period.days ? 'primary' : 'secondary'"
          :outlined="days !== period.days"
          size="small"
          @click="days = period.days"
        />
      </div>
      <Message v-if="analytics.query.isLoading.value" severity="info" :closable="false">
        Загружаем агрегаты…
      </Message>
      <Message v-else-if="analytics.query.isError.value" severity="error" :closable="false">
        Показатели не удалось загрузить. Проверьте доступ и повторите попытку.
        <Button label="Повторить" size="small" text @click="analytics.query.refetch()" />
      </Message>
      <div v-else-if="data" class="space-y-6">
        <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Основные показатели">
          <Card v-for="metric in metrics" :key="metric.label">
            <template #title>{{ metric.label }}</template>
            <template #content
              ><p class="text-3xl font-semibold">{{ metric.value }}</p></template
            >
          </Card>
        </section>
        <section class="rounded-lg border border-surface p-4">
          <h2 class="font-semibold">Технические ошибки</h2>
          <p
            v-if="!Object.keys(data.errors ?? {}).length"
            class="mt-2 text-sm text-color-secondary"
          >
            Ошибок за период нет.
          </p>
          <dl v-else class="mt-3 grid gap-2 sm:grid-cols-2">
            <div
              v-for="[category, count] in errorRows"
              :key="category"
              class="flex justify-between gap-4 text-sm"
            >
              <dt>{{ errorLabel(category) }}</dt>
              <dd class="font-medium">{{ count }}</dd>
            </div>
          </dl>
        </section>
      </div>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useInternalAuth } from "~/features/internal-auth/composables/useInternalAuth";
import { useInternalProductAnalytics } from "../composables/useInternalProductAnalytics";

defineOptions({ name: "InternalProductAnalyticsScreen" });

const periods = [
  { label: "7 дней", days: 7 },
  { label: "30 дней", days: 30 },
  { label: "90 дней", days: 90 },
];
const auth = useInternalAuth();
const loadingSession = ref(true);
const enabled = ref(false);
const days = ref(30);
const analytics = useInternalProductAnalytics(days, enabled);
const authorized = computed(
  () => auth.state.user?.permissions.includes("product_analytics") ?? false,
);
const data = computed(() => analytics.query.data.value);
const counts = computed(() => data.value?.counts ?? {});
const errorRows = computed(() =>
  Object.entries(data.value?.errors ?? {}).sort(([left], [right]) => left.localeCompare(right)),
);
const searchCount = computed(() => counts.value.SEARCH_USED ?? 0);
const emptySearchCount = computed(() => counts.value.SEARCH_EMPTY ?? 0);
const metrics = computed(() => [
  { label: "Поиски", value: searchCount.value },
  {
    label: "Пустые результаты",
    value: `${emptySearchCount.value} (${searchCount.value ? Math.round((emptySearchCount.value / searchCount.value) * 100) : 0}%)`,
  },
  { label: "Открытия карточек", value: counts.value.PRODUCT_OPENED ?? 0 },
  { label: "Начала создания", value: counts.value.PRODUCT_CREATE_STARTED ?? 0 },
  { label: "Успешные создания", value: counts.value.PRODUCT_CREATE_COMPLETED ?? 0 },
  {
    label: "Архивирования / восстановления",
    value: `${counts.value.PRODUCT_ARCHIVED ?? 0} / ${counts.value.PRODUCT_RESTORED ?? 0}`,
  },
]);

onMounted(async () => {
  await auth.loadSession();
  enabled.value = Boolean(auth.state.user?.permissions.includes("product_analytics"));
  loadingSession.value = false;
});

function errorLabel(category: string): string {
  return (
    (
      {
        NETWORK: "Сеть",
        API: "Ошибка API",
        VALIDATION: "Проверка данных",
        UNKNOWN: "Другая",
      } as Record<string, string>
    )[category] ?? "Другая"
  );
}
</script>
