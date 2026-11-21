<template>
  <section
    class="w-full min-w-0 rounded-lg border border-[var(--p-content-border-color)] p-2"
    aria-labelledby="recent-audit-events-title"
  >
    <header class="flex items-center justify-between gap-2">
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <i class="pi pi-history text-sm text-primary" aria-hidden="true" />
        <h2 id="recent-audit-events-title" class="text-sm font-semibold">Последние изменения</h2>
      </div>
      <Button
        :icon="collapsed ? 'pi pi-chevron-down' : 'pi pi-chevron-up'"
        :aria-label="collapsed ? 'Развернуть последние изменения' : 'Свернуть последние изменения'"
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
          <LoadingIndicator v-if="historyQuery.isLoading.value" />
          <div v-else-if="historyQuery.isError.value" class="p-1">
            <Message severity="error" :closable="false" :pt="compactMessagePt">
              Историю не удалось загрузить.
              <Button label="Повторить" size="small" text @click="historyQuery.refetch()" />
            </Message>
          </div>
          <p v-else-if="!events.length" class="text-xs text-color-secondary" aria-live="polite">
            Пока изменений нет.
          </p>
          <ul v-else class="space-y-1" aria-label="Три последних действия">
            <li v-for="(event, index) in events" :key="event.id" class="min-w-0">
              <p class="break-words text-sm">{{ event.summary }}</p>
              <div class="flex flex-wrap gap-x-1 text-xs text-color-secondary">
                <span>{{ formatDate(event.createdAt) }}</span>
                <span aria-hidden="true">·</span>
                <span>{{ event.actorName ?? "Аккаунт недоступен" }}</span>
              </div>
              <Divider v-if="index < events.length - 1" class="!my-1" />
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { AuditControllerListParams } from "@bartech/api-client";
import { useAuditHistory } from "~/features/history/composables/useAuditHistory";
import { compactMessagePt } from "~/utils/primevue-message";

const props = defineProps<{ companyId: string; venueId: string }>();
const filters: AuditControllerListParams = { page: 1, limit: 10 };
const { historyQuery } = useAuditHistory(
  () => props.companyId,
  () => props.venueId,
  filters,
);
const events = computed(() => historyQuery.data.value?.items.slice(0, 3) ?? []);
const collapsed = ref(false);

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
</script>
