<template>
  <main class="mx-auto max-w-4xl px-4 py-8 sm:px-6">
    <header class="mb-6">
      <NuxtLink to="/" class="text-sm font-semibold text-primary">IndieBar</NuxtLink>
      <h1 class="mt-4 text-2xl font-semibold tracking-tight">Помощь</h1>
      <p class="mt-2 text-sm text-color-secondary">
        Напишите команде IndieBar. Обращение не предоставляет сотрудникам доступ к данным заведения.
      </p>
    </header>

    <LoadingIndicator v-if="sessionState === 'loading' || sessionState === 'idle'" screen />
    <Message v-else-if="sessionState === 'unauthenticated'" severity="warn" :closable="false">
      Чтобы отправить обращение, войдите в аккаунт.
      <NuxtLink to="/" class="ml-1 underline">Перейти ко входу</NuxtLink>
    </Message>
    <Message v-else-if="sessionState === 'error'" severity="error" :closable="false">
      {{ sessionErrorMessage }}
    </Message>
    <div v-else class="space-y-8">
      <Card>
        <template #title>Новое обращение</template>
        <template #content>
          <Message v-if="formError" severity="error" :closable="false" class="mb-4">
            {{ formError }}
          </Message>
          <form class="space-y-4" @submit.prevent="submit">
            <FloatLabel variant="on">
              <Select
                id="support-reason"
                v-model="reason"
                :options="reasons"
                option-label="label"
                option-value="value"
                size="small"
                class="w-full"
              />
              <label for="support-reason">Причина обращения</label>
            </FloatLabel>
            <FloatLabel variant="on">
              <Textarea
                id="support-message"
                v-model="message"
                required
                maxlength="5000"
                rows="5"
                class="w-full"
              />
              <label for="support-message">Сообщение</label>
            </FloatLabel>
            <div>
              <label for="support-file" class="mb-1 block text-sm font-medium"
                >Файл, необязательно</label
              >
              <input
                id="support-file"
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,.png,.jpg"
                class="block w-full text-sm text-color-secondary file:mr-3 file:rounded-md file:border-0 file:bg-surface-100 file:px-3 file:py-2 file:text-color"
                @change="selectFile"
              />
              <p class="mt-1 text-xs text-color-secondary">
                XLSX, XLS, CSV, PDF, PNG или JPG; не более 20 МБ.
              </p>
            </div>
            <p v-if="selectedFile" class="text-sm text-color-secondary">{{ selectedFile.name }}</p>
            <Button type="submit" label="Отправить обращение" size="small" :loading="sending" />
          </form>
        </template>
      </Card>

      <Card v-if="grantContext">
        <template #title>Временный доступ к продукции</template>
        <template #content>
          <p class="text-sm text-color-secondary">{{ grantScopeDescription }}</p>
          <p v-if="!matchingRequest" class="mt-3 text-sm text-color-secondary">
            Сначала отправьте обращение по этому заведению.
          </p>
          <Button
            label="Выдать доступ на 7 дней"
            size="small"
            class="mt-3"
            :disabled="!matchingRequest"
            :loading="grantCreating"
            @click="createGrant"
          />
          <Message v-if="grantError" severity="error" :closable="false" class="mt-3">{{
            grantError
          }}</Message>
          <LoadingIndicator v-if="grants.grantsQuery.isLoading.value" class="mt-3" />
          <ul v-else-if="grants.grantsQuery.data.value?.length" class="mt-4 space-y-2">
            <li
              v-for="grant in grants.grantsQuery.data.value"
              :key="grant.id"
              class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-surface p-3"
            >
              <div class="text-sm">
                <p class="font-medium">
                  {{ grant.scopeType === "COMPANY" ? grant.companyName : grant.venueName }}
                </p>
                <p class="text-color-secondary">
                  До {{ formatDate(grant.expiresAt) }} ·
                  {{ grant.active ? "активен" : grant.revokedAt ? "отозван" : "истёк" }}
                </p>
              </div>
              <Button
                v-if="grant.active"
                label="Отозвать"
                severity="danger"
                size="small"
                :loading="revokingGrantId === grant.id"
                @click="revokeGrant(grant.id)"
              />
            </li>
          </ul>
        </template>
      </Card>

      <section>
        <h2 class="mb-3 text-lg font-semibold">Мои обращения</h2>
        <LoadingIndicator v-if="requests.requestsQuery.isLoading.value" />
        <Message
          v-else-if="requests.requestsQuery.isError.value"
          severity="error"
          :closable="false"
        >
          Не удалось загрузить обращения. Попробуйте обновить страницу.
        </Message>
        <p
          v-else-if="!requests.requestsQuery.data.value?.length"
          class="rounded-lg border border-surface p-5 text-sm text-color-secondary"
        >
          Обращений пока нет.
        </p>
        <ul v-else class="space-y-3">
          <li
            v-for="request in requests.requestsQuery.data.value"
            :key="request.id"
            class="rounded-lg border border-surface bg-surface-0 p-4"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="font-medium">{{ reasonLabel(request.reason) }}</h3>
              <Tag
                :value="statusLabel(request.status)"
                :severity="statusSeverity(request.status)"
              />
            </div>
            <p class="mt-2 whitespace-pre-wrap text-sm">{{ request.message }}</p>
            <p class="mt-2 text-xs text-color-secondary">{{ formatDate(request.createdAt) }}</p>
            <div v-if="request.attachment" class="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span>{{ request.attachment.originalName }}</span>
              <span class="text-color-secondary"
                >· {{ attachmentStatus(request.attachment.status) }}</span
              >
              <Button
                v-if="request.attachment.status === 'clean'"
                label="Скачать"
                icon="pi pi-download"
                severity="secondary"
                size="small"
                @click="requests.download(request.id)"
              />
            </div>
          </li>
        </ul>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { SupportControllerCreateBody } from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { useSupportRequests } from "../composables/useSupportRequests";
import { useSupportAccessGrants } from "../composables/useSupportAccessGrants";

defineOptions({ name: "SupportScreen" });

const identity = useIdentityFlow();
const requests = useSupportRequests();
const grants = useSupportAccessGrants();
const route = useRoute();
const reason = ref<SupportControllerCreateBody["reason"]>("other");
const message = ref("");
const selectedFile = ref<File | null>(null);
const sending = ref(false);
const formError = ref("");
const reasons = [
  { label: "Перенос данных", value: "data_migration" },
  { label: "Ошибка", value: "error" },
  { label: "Другой вопрос", value: "other" },
];
const grantCreating = ref(false);
const revokingGrantId = ref("");
const grantError = ref("");
const grantCompanyId = stringQuery(route.query.companyId);
const grantVenueId = stringQuery(route.query.venueId);
const grantContext = computed(() => {
  const workplaces = identity.currentUser.value?.workplaces ?? [];
  return workplaces.find(
    (workspace) =>
      workspace.company.id === grantCompanyId &&
      (!grantVenueId || workspace.venue.id === grantVenueId),
  );
});
const grantScopeDescription = computed(() =>
  grantContext.value?.role === "bar_manager"
    ? `Будет предоставлен доступ только к заведению «${grantContext.value.venue.name}» на семь дней.`
    : `Будет предоставлен доступ ко всей компании «${grantContext.value?.company.name}» на семь дней.`,
);
const matchingRequest = computed(() =>
  requests.requestsQuery.data.value?.find(
    (request) =>
      request.companyId === grantContext.value?.company.id &&
      (grantContext.value?.role !== "bar_manager" ||
        request.venueId === grantContext.value.venue.id),
  ),
);

onMounted(async () => {
  if (identity.sessionState.value === "idle") {
    await Promise.allSettled([identity.refreshCsrf()]);
    await identity.loadSession();
  }
});

function selectFile(event: Event) {
  selectedFile.value = (event.target as HTMLInputElement).files?.[0] ?? null;
}

async function createGrant() {
  if (!grantContext.value || !window.confirm(`Выдать доступ? ${grantScopeDescription.value}`))
    return;
  grantError.value = "";
  grantCreating.value = true;
  try {
    await grants.create({
      companyId: grantContext.value.company.id,
      ...(grantContext.value.role === "bar_manager"
        ? { venueId: grantContext.value.venue.id }
        : {}),
      requestId: matchingRequest.value?.id,
    });
  } catch (error) {
    grantError.value = error instanceof Error ? error.message : "Не удалось выдать доступ";
  } finally {
    grantCreating.value = false;
  }
}

async function revokeGrant(grantId: string) {
  if (!window.confirm("Отозвать доступ? Активная служебная сессия завершится.")) return;
  grantError.value = "";
  revokingGrantId.value = grantId;
  try {
    await grants.revoke(grantId);
  } catch (error) {
    grantError.value = error instanceof Error ? error.message : "Не удалось отозвать доступ";
  } finally {
    revokingGrantId.value = "";
  }
}

async function submit() {
  formError.value = "";
  sending.value = true;
  try {
    const input: SupportControllerCreateBody = {
      reason: reason.value,
      message: message.value,
      browser: typeof navigator === "undefined" ? undefined : navigator.userAgent.slice(0, 200),
      companyId: stringQuery(route.query.companyId),
      venueId: stringQuery(route.query.venueId),
      file: selectedFile.value ?? undefined,
    };
    await requests.create(input);
    message.value = "";
    selectedFile.value = null;
    const fileInput = document.getElementById("support-file") as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";
  } catch (error) {
    formError.value = error instanceof Error ? error.message : "Не удалось отправить обращение";
  } finally {
    sending.value = false;
  }
}

function stringQuery(value: unknown): string | undefined {
  return typeof value === "string" && value.length ? value : undefined;
}

function reasonLabel(value: string) {
  return (
    { data_migration: "Перенос данных", error: "Ошибка", other: "Другой вопрос" }[value] ?? value
  );
}

function statusLabel(value: string) {
  return { new: "Новое", in_progress: "В работе", closed: "Закрыто" }[value] ?? value;
}

function statusSeverity(value: string) {
  return value === "closed" ? "secondary" : value === "in_progress" ? "info" : "warn";
}

function attachmentStatus(value: string) {
  return (
    { pending_scan: "проверяется", clean: "проверен", rejected: "не прошёл проверку" }[value] ??
    value
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

const sessionState = identity.sessionState;
const sessionErrorMessage = identity.sessionErrorMessage;
useSeoMeta({ title: "Помощь — IndieBar", robots: "noindex, nofollow" });
</script>
