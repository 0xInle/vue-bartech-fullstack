<template>
  <main class="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <header class="mb-6">
      <NuxtLink to="/internal" class="text-sm font-semibold text-primary"
        >Внутренняя панель</NuxtLink
      >
      <h1 class="mt-4 text-2xl font-semibold tracking-tight">Временный доступ к продукции</h1>
      <p class="mt-2 text-sm text-color-secondary">
        Доступ ограничен продуктами выбранного заведения и сроком grant.
      </p>
    </header>

    <Message v-if="loadingSession" severity="info" :closable="false"
      >Проверяем внутреннюю сессию…</Message
    >
    <Message
      v-else-if="!auth.state.user || !auth.state.user.permissions.includes('service_access')"
      severity="error"
      :closable="false"
      >Нет разрешения на служебный доступ.</Message
    >
    <Message v-else-if="error" severity="error" :closable="false">{{ error }}</Message>
    <Message v-else-if="!access.grantsQuery.data.value?.length" severity="info" :closable="false"
      >Действующих временных доступов пока нет.</Message
    >
    <ul v-else class="space-y-3">
      <li
        v-for="grant in access.grantsQuery.data.value"
        :key="grant.id"
        class="rounded-lg border border-surface bg-surface-0 p-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold">
              {{ grant.scopeType === "COMPANY" ? grant.company.name : grant.venue?.name }}
            </h2>
            <p class="mt-1 text-sm text-color-secondary">
              {{ grant.scopeType === "COMPANY" ? "Вся компания" : "Одно заведение" }} · действует до
              {{ formatDate(grant.expiresAt) }}
            </p>
            <p v-if="grant.author?.profile?.fullName" class="mt-1 text-sm">
              Выдал: {{ grant.author.profile.fullName }}
            </p>
          </div>
          <Button
            v-if="!grant.sessions.length"
            label="Начать сессию"
            size="small"
            :loading="startingGrantId === grant.id"
            @click="start(grant.id)"
          />
        </div>
        <ul v-if="grant.sessions.length" class="mt-4 space-y-2">
          <li
            v-for="session in grant.sessions"
            :key="session.id"
            class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-50 p-3"
          >
            <div>
              <Tag value="Сессия активна" severity="success" />
              <p class="mt-2 text-sm text-color-secondary">
                До {{ formatDate(session.expiresAt) }}
              </p>
              <label v-if="grant.scopeType === 'COMPANY'" class="mt-3 block text-sm">
                Выберите заведение
                <Select
                  v-model="venueBySession[session.id]"
                  :options="grant.company.venues"
                  option-label="name"
                  option-value="id"
                  size="small"
                  class="mt-1 w-full"
                />
              </label>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button
                label="Открыть продукцию"
                size="small"
                :disabled="!sessionVenue(grant, session.id)"
                @click="openProducts(grant, session.id)"
              />
              <Button
                label="Завершить"
                severity="secondary"
                size="small"
                :loading="endingSessionId === session.id"
                @click="end(session.id)"
              />
            </div>
          </li>
        </ul>
      </li>
    </ul>
  </main>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useInternalAuth } from "~/features/internal-auth/composables/useInternalAuth";
import {
  useInternalServiceAccess,
  type ServiceGrant,
} from "../composables/useInternalServiceAccess";

defineOptions({ name: "InternalServiceAccessScreen" });

const auth = useInternalAuth();
const enabled = ref(false);
const loadingSession = ref(true);
const error = ref("");
const startingGrantId = ref("");
const endingSessionId = ref("");
const venueBySession = reactive<Record<string, string>>({});
const access = useInternalServiceAccess(enabled);

onMounted(async () => {
  await auth.loadSession();
  loadingSession.value = false;
  enabled.value = Boolean(auth.state.user?.permissions.includes("service_access"));
});

function sessionVenue(grant: ServiceGrant, sessionId: string) {
  return grant.venue?.id ?? venueBySession[sessionId] ?? "";
}

async function start(grantId: string) {
  error.value = "";
  startingGrantId.value = grantId;
  try {
    await access.start(grantId);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Не удалось начать сессию";
  } finally {
    startingGrantId.value = "";
  }
}

async function end(sessionId: string) {
  error.value = "";
  endingSessionId.value = sessionId;
  try {
    await access.end(sessionId);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "Не удалось завершить сессию";
  } finally {
    endingSessionId.value = "";
  }
}

function openProducts(grant: ServiceGrant, sessionId: string) {
  const venueId = sessionVenue(grant, sessionId);
  if (!venueId) return;
  return navigateTo(
    `/internal/service-sessions/${sessionId}/companies/${grant.company.id}/venues/${venueId}/products`,
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}
</script>
