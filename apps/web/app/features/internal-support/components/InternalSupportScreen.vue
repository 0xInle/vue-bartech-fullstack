<template>
  <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <header class="mb-6">
      <NuxtLink to="/internal" class="text-sm font-semibold text-primary"
        >Внутренняя панель</NuxtLink
      >
      <h1 class="text-xl mt-4 font-semibold tracking-tight">Обращения в поддержку</h1>
      <p class="mt-2 text-sm text-color-secondary">
        Обращения не открывают доступ к продукции компании.
      </p>
    </header>

    <LoadingIndicator v-if="loadingSession" screen />
    <Message v-else-if="!canAccess" severity="error" :closable="false">
      {{
        auth.state.user ? "У вас нет доступа к очереди поддержки." : "Внутренняя сессия недоступна."
      }}
    </Message>
    <div v-else class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section>
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-base font-semibold">Очередь</h2>
          <Select
            v-model="status"
            :options="statusOptions"
            option-label="label"
            option-value="value"
            size="small"
            aria-label="Фильтр по статусу"
            @update:model-value="page = 1"
          />
        </div>
        <LoadingIndicator v-if="queue.queueQuery.isLoading.value" screen />
        <Message v-else-if="queue.queueQuery.isError.value" severity="error" :closable="false"
          >Не удалось загрузить очередь.</Message
        >
        <p
          v-else-if="!items.length"
          class="rounded-lg border border-surface p-5 text-sm text-color-secondary"
        >
          Обращений пока нет.
        </p>
        <ul v-else class="space-y-2">
          <li v-for="request in items" :key="request.id">
            <button
              type="button"
              class="w-full rounded-lg border p-4 text-left"
              :class="
                selectedId === request.id
                  ? 'border-primary bg-primary-50'
                  : 'border-surface bg-surface-0'
              "
              @click="selectRequest(request.id)"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="font-medium">{{ reasonLabel(request.reason) }}</span>
                <Tag
                  v-if="unreadCount(request.id)"
                  :value="String(unreadCount(request.id))"
                  severity="warn"
                />
                <Tag
                  :value="statusLabel(request.status)"
                  :severity="statusSeverity(request.status)"
                />
              </div>
              <p class="mt-2 line-clamp-2 text-sm text-color-secondary">{{ request.message }}</p>
              <p class="mt-2 text-xs text-color-secondary">
                {{ request.author?.email ?? "Аккаунт обезличен" }} ·
                {{ formatDate(request.createdAt) }}
              </p>
            </button>
          </li>
        </ul>
        <div v-if="total > 50" class="mt-3 flex items-center justify-between">
          <Button
            label="Назад"
            severity="secondary"
            size="small"
            :disabled="page <= 1"
            @click="page -= 1"
          />
          <span class="text-sm">Страница {{ page }}</span>
          <Button
            label="Дальше"
            severity="secondary"
            size="small"
            :disabled="page * 50 >= total"
            @click="page += 1"
          />
        </div>
      </section>

      <Card v-if="selected" class="h-fit">
        <template #title>{{ reasonLabel(selected.reason) }}</template>
        <template #content>
          <p class="whitespace-pre-wrap text-sm">{{ selected.message }}</p>
          <dl class="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt class="text-color-secondary">Автор</dt>
              <dd>
                {{ selected.author?.fullName || selected.author?.email || "Аккаунт обезличен" }}
              </dd>
            </div>
            <div>
              <dt class="text-color-secondary">Создано</dt>
              <dd>{{ formatDate(selected.createdAt) }}</dd>
            </div>
            <div>
              <dt class="text-color-secondary">Компания</dt>
              <dd>{{ selected.companyId ?? "Не указана" }}</dd>
            </div>
            <div>
              <dt class="text-color-secondary">Заведение</dt>
              <dd>{{ selected.venueId ?? "Не указано" }}</dd>
            </div>
            <div
              v-for="(value, key) in selected.technicalContext ?? {}"
              :key="key"
              class="break-words"
            >
              <dt class="text-color-secondary">{{ contextLabel(String(key)) }}</dt>
              <dd>{{ value }}</dd>
            </div>
          </dl>

          <div v-if="selected.status !== 'closed'" class="mt-5 grid gap-3 sm:grid-cols-2">
            <FloatLabel variant="on">
              <Select
                id="support-status"
                v-model="editStatus"
                :options="editableStatusOptions"
                option-label="label"
                option-value="value"
                option-disabled="disabled"
                size="small"
                class="w-full"
              />
              <label for="support-status">Статус</label>
            </FloatLabel>
            <FloatLabel variant="on">
              <Select
                id="support-assignee"
                v-model="assigneeId"
                :options="assigneeOptions"
                option-label="label"
                option-value="value"
                size="small"
                class="w-full"
              />
              <label for="support-assignee">Ответственный</label>
            </FloatLabel>
          </div>
          <Message v-if="hasActiveGrant" severity="warn" :closable="false" class="mt-3">
            Сначала отзовите временный доступ, чтобы закрыть обращение.
          </Message>
          <Message v-if="actionError" severity="error" :closable="false" class="mt-3">{{
            actionError
          }}</Message>
          <Button
            v-if="selected.status !== 'closed'"
            label="Сохранить"
            size="small"
            class="mt-3"
            :loading="saving"
            @click="save"
          />
          <p v-else class="mt-5 text-sm text-color-secondary">
            Обращение закрыто. Переписка доступна только для чтения.
          </p>

          <ul v-if="selected.attachments.length" class="mt-5 space-y-3">
            <li
              v-for="attachment in selected.attachments"
              :key="attachment.id"
              class="rounded-lg border border-surface p-3"
            >
              <p class="break-all text-sm font-medium">{{ attachment.originalName }}</p>
              <p class="mt-1 text-sm text-color-secondary">
                {{ attachmentStatus(attachment.status) }} · {{ formatBytes(attachment.sizeBytes) }}
              </p>
              <Button
                v-if="attachment.status === 'clean'"
                label="Скачать проверенное вложение"
                icon="pi pi-download"
                severity="secondary"
                size="small"
                class="mt-3"
                @click="queue.download(selected.id, attachment.id)"
              />
            </li>
          </ul>
          <Divider class="!my-5" />
          <section aria-label="Переписка с пользователем" class="space-y-3">
            <h2 class="text-base font-semibold">Переписка</h2>
            <LoadingIndicator v-if="queue.messagesQuery.isLoading.value" />
            <div
              v-for="item in queue.messagesQuery.data.value ?? []"
              :key="item.id"
              class="flex"
              :class="item.authorType === 'internal' ? 'justify-end' : 'justify-start'"
            >
              <article
                class="max-w-[85%] rounded-lg bg-surface-100 px-3 py-2"
                :class="item.authorType === 'internal' ? 'bg-primary-50' : ''"
              >
                <p class="text-xs font-semibold">
                  {{ item.authorName }}
                  <span class="font-normal text-color-secondary"
                    >· {{ formatDate(item.createdAt) }}</span
                  >
                </p>
                <p class="mt-1 whitespace-pre-wrap text-sm">{{ item.body }}</p>
                <p
                  v-if="item.kind === 'access_request' && !item.accessGrant"
                  class="mt-2 text-xs text-color-secondary"
                >
                  Запрос временного доступа к продукции (до 7 дней).
                </p>
                <div
                  v-if="item.accessGrant"
                  class="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-color-secondary"
                >
                  <span v-if="item.accessGrant.active">
                    Доступ активен до {{ formatDate(item.accessGrant.expiresAt) }}.
                  </span>
                  <span v-else-if="item.accessGrant.revokedAt">
                    Доступ отозван {{ formatDate(item.accessGrant.revokedAt) }}.
                  </span>
                  <span v-else
                    >Срок доступа истёк {{ formatDate(item.accessGrant.expiresAt) }}.</span
                  >
                  <Button
                    v-if="item.accessGrant.active"
                    label="Отозвать доступ"
                    severity="danger"
                    size="small"
                    :loading="revokingGrantId === item.accessGrant.id"
                    :disabled="Boolean(revokingGrantId)"
                    @click="revokeAccess(selected.id, item.accessGrant.id)"
                  />
                </div>
              </article>
            </div>
            <div v-if="selected.status !== 'closed'" class="space-y-3">
              <Textarea
                v-model="replyText"
                rows="3"
                auto-resize
                class="w-full"
                placeholder="Ответ пользователю"
                :disabled="replySending"
              />
              <div class="flex flex-wrap justify-end gap-2">
                <Button
                  v-if="accessStateLoaded && !hasActiveGrant"
                  label="Запросить временный доступ"
                  severity="secondary"
                  size="small"
                  :disabled="selected.reason !== 'data_migration' || !replyText.trim()"
                  :loading="replySending"
                  @click="sendInternalReply(true)"
                />
                <Button
                  label="Отправить ответ"
                  icon="pi pi-send"
                  size="small"
                  :disabled="!replyText.trim()"
                  :loading="replySending"
                  @click="sendInternalReply(false)"
                />
              </div>
            </div>
          </section>
        </template>
      </Card>
      <p v-else class="rounded-lg border border-surface p-5 text-sm text-color-secondary">
        Выберите обращение в очереди.
      </p>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useInternalAuth } from "~/features/internal-auth/composables/useInternalAuth";
import { useInternalSupportQueue } from "../composables/useInternalSupportQueue";

defineOptions({ name: "InternalSupportScreen" });

const auth = useInternalAuth();
const status = ref("");
const page = ref(1);
const enabled = ref(false);
const loadingSession = ref(true);
const selectedId = ref("");
const editStatus = ref<"new" | "in_progress" | "closed">("new");
const assigneeId = ref("");
const saving = ref(false);
const actionError = ref("");
const replyText = ref("");
const replySending = ref(false);
const revokingGrantId = ref("");
const statusOptions = [
  { label: "Все статусы", value: "" },
  { label: "Новое", value: "new" },
  { label: "В работе", value: "in_progress" },
  { label: "Ждём ответа пользователя", value: "waiting_on_customer" },
  { label: "Закрыто", value: "closed" },
];
const queue = useInternalSupportQueue(enabled, status, page);
const canAccess = computed(() =>
  Boolean(auth.state.user?.permissions.includes("support_requests")),
);
const items = computed(() => queue.queueQuery.data.value?.items ?? []);
const total = computed(() => queue.queueQuery.data.value?.total ?? 0);
const selected = computed(() => items.value.find((request) => request.id === selectedId.value));
const hasActiveGrant = computed(
  () => queue.messagesQuery.data.value?.some((message) => message.accessGrant?.active) ?? false,
);
const accessStateLoaded = computed(
  () => !queue.messagesQuery.isLoading.value && Array.isArray(queue.messagesQuery.data.value),
);
const editableStatusOptions = computed(() =>
  statusOptions.slice(1).map((option) => ({
    ...option,
    disabled: option.value === "closed" && (!accessStateLoaded.value || hasActiveGrant.value),
  })),
);
const assigneeOptions = computed(() => [
  { label: "Не назначено", value: "" },
  ...(queue.usersQuery.data.value?.map((user) => ({ label: user.email, value: user.id })) ?? []),
]);

onMounted(async () => {
  await auth.loadSession();
  loadingSession.value = false;
  if (!auth.state.user) {
    await navigateTo("/internal");
    return;
  }
  enabled.value = canAccess.value;
});

watch(selected, (request) => {
  if (!request) return;
  editStatus.value = request.status as typeof editStatus.value;
  assigneeId.value = request.assignedTo?.id ?? "";
});

function selectRequest(id: string) {
  if (replySending.value || revokingGrantId.value) return;
  if (selectedId.value !== id) {
    replyText.value = "";
    actionError.value = "";
  }
  selectedId.value = id;
  queue.selectedRequestId.value = id;
}

watch(
  () => queue.messagesQuery.data.value,
  (messages) => {
    if (messages?.length && selectedId.value) void queue.markRead(selectedId.value);
  },
);

function unreadCount(requestId: string) {
  return (
    queue.unreadQuery.data.value?.requests.find((item) => item.requestId === requestId)
      ?.unreadCount ?? 0
  );
}

async function sendInternalReply(requestAccess: boolean) {
  if (!selected.value) return;
  replySending.value = true;
  actionError.value = "";
  try {
    await queue.sendMessage(selected.value.id, replyText.value, requestAccess);
    replyText.value = "";
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : "Не удалось отправить ответ";
  } finally {
    replySending.value = false;
  }
}

async function save() {
  if (!selected.value) return;
  if (editStatus.value === "closed" && (!accessStateLoaded.value || hasActiveGrant.value)) {
    actionError.value = hasActiveGrant.value
      ? "Сначала отзовите временный доступ или дождитесь его истечения."
      : "Дождитесь проверки временного доступа и попробуйте снова.";
    return;
  }
  saving.value = true;
  actionError.value = "";
  try {
    await queue.update(selected.value.id, {
      status: editStatus.value,
      assignedToId: assigneeId.value || null,
    });
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : "Не удалось сохранить изменения";
  } finally {
    saving.value = false;
  }
}

async function revokeAccess(requestId: string, grantId: string) {
  if (!window.confirm("Отозвать доступ? Активная служебная сессия завершится.")) return;
  revokingGrantId.value = grantId;
  actionError.value = "";
  try {
    await queue.revokeAccess(requestId, grantId);
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : "Не удалось отозвать доступ";
  } finally {
    revokingGrantId.value = "";
  }
}

function reasonLabel(value: string) {
  return (
    { data_migration: "Перенос данных", error: "Ошибка", other: "Другой вопрос" }[value] ?? value
  );
}

function statusLabel(value: string) {
  return (
    {
      new: "Новое",
      in_progress: "В работе",
      waiting_on_customer: "Ждём ответа",
      closed: "Закрыто",
    }[value] ?? value
  );
}

function statusSeverity(value: string) {
  return value === "closed" ? "secondary" : value === "in_progress" ? "info" : "warn";
}

function attachmentStatus(value: string) {
  return (
    {
      pending_scan: "Идёт проверка безопасности",
      clean: "Проверка безопасности пройдена",
      rejected: "Файл не прошёл проверку безопасности",
    }[value] ?? value
  );
}

function formatBytes(value: number): string {
  const formatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
  return value < 1024 * 1024
    ? `${Math.ceil(value / 1024)} КБ`
    : `${formatter.format(value / 1024 / 1024)} МБ`;
}

function contextLabel(value: string) {
  return { browser: "Браузер", errorId: "Идентификатор ошибки" }[value] ?? value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

useSeoMeta({ title: "Очередь поддержки — IndieBar", robots: "noindex, nofollow" });
</script>
