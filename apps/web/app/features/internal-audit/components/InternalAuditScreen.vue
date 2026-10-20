<template>
  <main class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <header class="mb-6">
      <NuxtLink to="/internal" class="text-sm font-semibold text-primary"
        >Внутренняя панель</NuxtLink
      >
      <h1 class="text-xl mt-4 font-semibold tracking-tight">Внутренний журнал действий</h1>
      <p class="mt-2 text-sm text-color-secondary">
        Служебные события IndieBar в обратном хронологическом порядке.
      </p>
    </header>

    <LoadingIndicator v-if="loadingSession" screen />
    <Message
      v-else-if="!auth.state.user || !auth.state.user.permissions.includes('internal_audit')"
      severity="error"
      :closable="false"
    >
      Нет разрешения на просмотр внутреннего журнала.
    </Message>
    <LoadingIndicator v-else-if="audit.query.isLoading.value" screen />
    <Message v-else-if="audit.query.isError.value" severity="error" :closable="false">
      Журнал не удалось загрузить. Проверьте доступ и повторите попытку.
      <Button label="Повторить" size="small" text @click="audit.query.refetch()" />
    </Message>
    <Message v-else-if="!audit.items.value.length" severity="secondary" :closable="false">
      Служебных событий пока нет.
    </Message>
    <div v-else class="divide-y divide-surface rounded-lg border border-surface">
      <article v-for="event in audit.items.value" :key="event.id" class="p-4">
        <p class="font-medium">{{ event.eventType }} · {{ actorLabel(event) }}</p>
        <p class="mt-1 text-sm text-color-secondary">
          {{ formatDate(event.createdAt) }}
        </p>
        <dl class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-color-secondary">
          <div v-if="event.companyId" class="flex gap-1">
            <dt>Компания:</dt>
            <dd class="font-mono">{{ event.companyId }}</dd>
          </div>
          <div v-if="event.venueId" class="flex gap-1">
            <dt>Заведение:</dt>
            <dd class="font-mono">{{ event.venueId }}</dd>
          </div>
          <div v-if="event.serviceSessionId" class="flex gap-1">
            <dt>Служебная сессия:</dt>
            <dd class="font-mono">{{ event.serviceSessionId }}</dd>
          </div>
        </dl>
      </article>
    </div>
    <div v-if="audit.query.hasNextPage.value" class="mt-4 flex justify-center">
      <Button
        label="Загрузить ещё"
        icon="pi pi-chevron-down"
        size="small"
        outlined
        :loading="audit.query.isFetchingNextPage.value"
        @click="audit.query.fetchNextPage()"
      />
    </div>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { InternalAuditEventDto } from "@bartech/api-client";
import { useInternalAuth } from "~/features/internal-auth/composables/useInternalAuth";
import { useInternalAudit } from "../composables/useInternalAudit";

defineOptions({ name: "InternalAuditScreen" });

const auth = useInternalAuth();
const loadingSession = ref(true);
const enabled = ref(false);
const audit = useInternalAudit(enabled);

onMounted(async () => {
  await auth.loadSession();
  enabled.value = Boolean(auth.state.user?.permissions.includes("internal_audit"));
  loadingSession.value = false;
});

function actorLabel(event: InternalAuditEventDto): string {
  if (event.actorEmail) return event.actorEmail;
  if (event.actorType === "OPERATOR") return "Оператор";
  if (event.actorType === "SYSTEM") return "Система";
  return "Внутренний сотрудник";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
</script>
