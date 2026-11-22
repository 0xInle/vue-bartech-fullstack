<template>
  <section class="w-full">
    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <div class="space-y-4">
        <section class="space-y-4">
          <h2 class="text-base font-semibold">Новое обращение</h2>
          <Message v-if="formError" severity="error" :closable="false" :pt="compactMessagePt">
            {{ formError }}
          </Message>
          <form class="space-y-4 pt-2" @submit.prevent="submit">
            <FloatLabel variant="on">
              <Select
                id="support-reason"
                v-model="reason"
                :options="reasons"
                required
                option-label="label"
                option-value="value"
                :invalid="submitAttempted && !reason"
                size="small"
                class="w-full"
              />
              <label for="support-reason" class="text-xs">Причина обращения</label>
            </FloatLabel>
            <div class="relative w-full">
              <FloatLabel variant="on" class="w-full">
                <Textarea
                  id="support-message"
                  v-model="message"
                  required
                  rows="5"
                  maxlength="1000"
                  size="small"
                  class="block w-full resize-none overflow-y-auto"
                  :invalid="message.length >= 1000"
                  :aria-invalid="message.length >= 1000"
                  :class="{ 'support-message-limit-invalid': message.length >= 1000 }"
                />
                <label for="support-message" class="text-xs">Сообщение</label>
              </FloatLabel>
            </div>
            <div>
              <input
                id="support-file"
                ref="fileInput"
                type="file"
                multiple
                accept=".xlsx,.xls,.pdf,.doc,.docx"
                class="sr-only"
                tabindex="-1"
                aria-hidden="true"
                @change="selectFiles"
              />
              <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Button
                  type="button"
                  label="Выбрать файл"
                  severity="secondary"
                  variant="outlined"
                  size="small"
                  aria-controls="support-file"
                  :disabled="sending || selectedFiles.length >= MAX_SUPPORT_FILE_COUNT"
                  @click="chooseFile"
                />
                <Divider layout="vertical" class="!mx-0 !my-0 !hidden self-stretch sm:!flex" />
                <Divider class="!my-0 w-full sm:!hidden" />
                <p
                  class="min-w-0 flex-1 text-xs text-color-secondary"
                  style="color: var(--p-text-muted-color)"
                >
                  Excel, Word и PDF. До 5 файлов, не более 20 МБ каждый.
                </p>
              </div>
            </div>
            <Message
              v-if="fileSelectionError"
              severity="error"
              :closable="false"
              :pt="compactMessagePt"
            >
              {{ fileSelectionError }}
            </Message>
            <ul v-if="selectedFiles.length" class="space-y-1">
              <li
                v-for="(file, index) in selectedFiles"
                :key="`${file.name}-${file.size}-${file.lastModified}`"
                class="flex min-w-0 items-center gap-2 text-xs text-color-secondary"
              >
                <span class="min-w-0 flex-1 truncate"
                  >{{ file.name }} · {{ formatBytes(file.size) }}</span
                >
                <Button
                  severity="secondary"
                  variant="text"
                  size="small"
                  label="Удалить"
                  :aria-label="`Удалить файл ${file.name}`"
                  :disabled="sending"
                  @click="removeFile(index)"
                />
              </li>
            </ul>
            <Button type="submit" label="Отправить обращение" size="small" :loading="sending" />
          </form>
        </section>
      </div>

      <Divider layout="vertical" class="!mx-0 !my-0 !hidden self-stretch lg:!flex" />
      <Divider class="!my-0 lg:!hidden" />

      <section class="space-y-3">
        <h2 class="text-base font-semibold">Мои обращения</h2>
        <LoadingIndicator v-if="requests.requestsQuery.isLoading.value" />
        <Message
          v-else-if="requests.requestsQuery.isError.value"
          severity="error"
          :closable="false"
          :pt="compactMessagePt"
        >
          Не удалось загрузить обращения. Попробуйте обновить страницу.
        </Message>
        <p v-else-if="!displayedRequests.length" class="mt-3 text-sm text-color-secondary">
          Обращений пока нет.
        </p>
        <DataTable
          v-else
          v-model:expanded-rows="expandedRows"
          :value="displayedRequests"
          data-key="id"
          size="small"
          row-hover
          class="support-requests-table text-sm"
          :pt="supportRequestsTablePt"
          @row-click="toggleRequest($event.data.id)"
          @row-keydown="onRequestRowKeydown"
        >
          <Column
            field="createdAt"
            header="Дата"
            :style="{ width: '1%', whiteSpace: 'nowrap' }"
            body-class="whitespace-nowrap text-sm font-normal"
          >
            <template #body="{ data }">
              <div class="flex items-center gap-2">
                <i
                  aria-hidden="true"
                  :class="expandedRows[data.id] ? 'pi-chevron-down' : 'pi-chevron-right'"
                  class="pi text-xs"
                />
                <span>{{ formatRequestDate(data.createdAt) }}</span>
              </div>
            </template>
          </Column>
          <Column
            header=""
            :style="{ width: '30px', minWidth: '30px', maxWidth: '30px' }"
            header-class="!p-0"
            body-class="!p-0"
          />
          <Column field="reason" header="Тип">
            <template #body="{ data }">
              <span class="text-sm font-normal">{{ reasonLabel(data.reason) }}</span>
            </template>
          </Column>
          <Column
            header=""
            :style="{ width: '30px', minWidth: '30px', maxWidth: '30px' }"
            header-class="!p-0"
            body-class="!p-0"
          />
          <Column
            header=""
            :style="{ width: '1%', whiteSpace: 'nowrap' }"
            header-class="!p-0"
            body-class="!p-0 text-center"
          >
            <template #body="{ data }">
              <Badge
                v-if="unreadCount(data.id) > 0"
                :value="unreadCount(data.id)"
                :aria-label="`Непрочитанных сообщений: ${unreadCount(data.id)}`"
                severity="success"
                size="small"
              />
            </template>
          </Column>
          <Column
            field="status"
            header="Статус"
            :style="{ width: '1%', whiteSpace: 'nowrap' }"
            body-class="whitespace-nowrap"
          >
            <template #body="{ data }">
              <Tag
                :value="statusLabel(data.status)"
                :severity="statusSeverity(data.status)"
                :pt="compactTagPt"
              />
            </template>
          </Column>
          <template #expansion="{ data }">
            <div
              :id="`support-request-${data.id}`"
              role="region"
              aria-label="Переписка с техподдержкой"
              class="space-y-3 py-1.5 text-sm"
            >
              <div ref="conversationHistory" class="max-h-[180px] space-y-3 overflow-y-auto">
                <LoadingIndicator v-if="conversation.messagesQuery.isLoading.value" />
                <div
                  v-for="item in conversationMessages(data.id)"
                  :key="item.id"
                  class="flex"
                  :class="item.authorType === 'customer' ? 'justify-end' : 'justify-start'"
                >
                  <article
                    class="max-w-[85%] rounded-lg px-3 py-2"
                    :class="
                      item.authorType === 'customer'
                        ? 'support-message-bubble--customer'
                        : 'support-message-bubble--support'
                    "
                  >
                    <p class="text-xs font-semibold">
                      {{ item.authorName }}
                      <span class="font-normal text-color-secondary"
                        >· {{ formatRequestDate(item.createdAt) }}</span
                      >
                    </p>
                    <p class="mt-1 whitespace-pre-wrap">{{ item.body }}</p>
                    <p
                      v-if="
                        item.kind === 'access_request' &&
                        !item.accessGrant &&
                        !activeAccessGrant?.active
                      "
                      class="mt-2 text-xs text-color-secondary"
                    >
                      Для переноса данных техподдержке потребуется временный доступ к продукции
                      сроком до 7 дней. Вы сможете отозвать его раньше.
                    </p>
                    <ul v-if="item.attachments.length" class="mt-2 space-y-1">
                      <li
                        v-for="attachment in item.attachments"
                        :key="attachment.id"
                        class="flex items-center gap-2 text-xs text-color-secondary"
                      >
                        <span class="min-w-0 flex-1 truncate"
                          >{{ attachment.originalName }} ·
                          {{ formatBytes(attachment.sizeBytes) }}</span
                        >
                        <Button
                          v-if="attachment.status === 'clean'"
                          label="Скачать"
                          severity="secondary"
                          size="small"
                          @click="requests.download(data.id, attachment.id)"
                        />
                        <span v-else>{{
                          attachment.status === "pending_scan" ? "Проверяется" : "Недоступен"
                        }}</span>
                      </li>
                    </ul>
                    <Button
                      v-if="item.kind === 'access_request' && !item.accessGrant"
                      label="Согласиться и предоставить доступ"
                      size="small"
                      class="mt-2"
                      @click="approveAccess(item.id)"
                    />
                  </article>
                </div>
              </div>
              <Message
                v-if="activeAccessGrant"
                severity="info"
                :closable="false"
                :pt="accessGrantMessagePt"
              >
                <div class="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <span class="min-w-0">{{
                    activeAccessGrant.active
                      ? "Временный доступ действует до " +
                        formatRequestDate(activeAccessGrant.expiresAt)
                      : "Временный доступ завершён"
                  }}</span>
                  <Button
                    v-if="activeAccessGrant.active"
                    label="Отозвать доступ"
                    severity="secondary"
                    size="small"
                    @click="revokeGrant(activeAccessGrant.id)"
                  />
                </div>
              </Message>
              <div v-if="data.status !== 'closed'" class="space-y-2">
                <div class="relative w-full mb-3">
                  <Textarea
                    v-model="replyText"
                    rows="3"
                    maxlength="1000"
                    class="block w-full resize-none overflow-y-auto"
                    placeholder="Напишите сообщение"
                    :disabled="replySending"
                    :invalid="replyText.length >= 1000"
                    :aria-invalid="replyText.length >= 1000"
                    :class="{ 'support-message-limit-invalid': replyText.length >= 1000 }"
                  />
                </div>
                <input
                  ref="replyFileInput"
                  type="file"
                  multiple
                  accept=".xlsx,.xls,.doc,.docx,.pdf"
                  class="sr-only"
                  :disabled="replySending"
                  @change="selectReplyFiles"
                />
                <ul v-if="replyFiles.length" class="space-y-1">
                  <li
                    v-for="(file, index) in replyFiles"
                    :key="`${file.name}-${file.size}`"
                    class="flex items-center gap-2 text-xs text-color-secondary"
                  >
                    <span class="min-w-0 flex-1 truncate"
                      >{{ file.name }} · {{ formatBytes(file.size) }}</span
                    ><Button
                      severity="secondary"
                      variant="text"
                      size="small"
                      label="Удалить"
                      :aria-label="`Удалить файл ${file.name}`"
                      :disabled="replySending"
                      @click="replyFiles.splice(index, 1)"
                    />
                  </li>
                </ul>
                <Message
                  v-if="replyError"
                  severity="error"
                  :closable="false"
                  :pt="compactMessagePt"
                  >{{ replyError }}</Message
                >
                <div class="flex items-center justify-between">
                  <Button
                    label="Прикрепить файл"
                    severity="secondary"
                    variant="outlined"
                    size="small"
                    :disabled="
                      replySending ||
                      data.attachments.length + replyFiles.length >= MAX_SUPPORT_FILE_COUNT
                    "
                    @click="replyFileInput?.click()"
                  />
                  <Button
                    label="Отправить"
                    size="small"
                    :disabled="replySending || (!replyText.trim() && !replyFiles.length)"
                    :loading="replySending"
                    @click="sendReply"
                  />
                </div>
              </div>
              <p v-else class="text-xs text-color-secondary">
                Обращение закрыто. Чтобы продолжить, создайте новое обращение.
              </p>
            </div>
          </template>
        </DataTable>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { SupportControllerCreateBody, SupportRequestResponseDto } from "@bartech/api-client";
import type { DataTablePassThroughMethodOptions } from "primevue/datatable";
import type { Workspace } from "~/types/user-workspaces";
import { compactMessagePt } from "~/utils/primevue-message";
import { useSupportRequests } from "../composables/useSupportRequests";
import { useSupportConversation } from "../composables/useSupportConversation";
import { useSupportUnreadCount } from "../composables/useSupportUnreadCount";

defineOptions({ name: "SupportScreen" });

const props = defineProps<{ workspace: Workspace }>();
const requests = useSupportRequests();
const unread = useSupportUnreadCount();
const reason = ref<SupportControllerCreateBody["reason"] | "">("");
const message = ref("");
const MAX_SUPPORT_FILE_COUNT = 5;
const MAX_SUPPORT_FILE_BYTES = 20 * 1024 * 1024;
const selectedFiles = ref<File[]>([]);
const fileSelectionError = ref("");
const fileInput = ref<HTMLInputElement | null>(null);
const sending = ref(false);
const formError = ref("");
const submitAttempted = ref(false);
const reasons = [
  { label: "Перенос данных", value: "data_migration" },
  { label: "Ошибка", value: "error" },
  { label: "Другой вопрос", value: "other" },
];
const displayedRequests = computed(() => requests.requestsQuery.data.value ?? []);
const expandedRows = ref<Record<string, boolean>>({});
const activeRequestId = computed(
  () => Object.keys(expandedRows.value).find((id) => expandedRows.value[id]) ?? "",
);
const conversationHistory = ref<HTMLDivElement | null>(null);
const pendingScrollRequestId = ref("");
const conversation = useSupportConversation(
  activeRequestId,
  computed(() => Boolean(activeRequestId.value)),
);
const replyText = ref("");
const replySending = ref(false);
const replyError = ref("");
const replyFiles = ref<File[]>([]);
const replyFileInput = ref<HTMLInputElement | null>(null);
const supportRequestsTablePt = {
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
  bodyRow: ({ context, props }: DataTablePassThroughMethodOptions) => {
    const request = props.value[context.index] as SupportRequestResponseDto;

    return {
      class: "cursor-pointer",
      tabindex: 0,
      "aria-expanded": Boolean(expandedRows.value[request.id]),
      "aria-controls": `support-request-${request.id}`,
    };
  },
};
const compactTagPt = {
  root: {
    style: { fontSize: "0.75rem", padding: "0.125rem 0.375rem" },
  },
  label: { style: { fontWeight: "400" } },
};
const accessGrantMessagePt = {
  ...compactMessagePt,
  content: { class: "w-full" },
  text: { ...compactMessagePt.text, class: "w-full" },
};

watch(
  () => conversation.messagesQuery.data.value,
  (items) => {
    if (items?.length && activeRequestId.value) {
      void conversation.markRead();
      if (pendingScrollRequestId.value === activeRequestId.value) {
        void scrollConversationToBottom(activeRequestId.value);
      }
    }
  },
);

watch(activeRequestId, (requestId, previousRequestId) => {
  pendingScrollRequestId.value = requestId;
  if (requestId && conversation.messagesQuery.data.value?.length) {
    void scrollConversationToBottom(requestId);
  }
  if (!previousRequestId || requestId === previousRequestId) return;
  replyText.value = "";
  replyFiles.value = [];
  replyError.value = "";
});

async function scrollConversationToBottom(requestId: string) {
  await nextTick();
  if (activeRequestId.value !== requestId || !conversationHistory.value) return;
  conversationHistory.value.scrollTop = conversationHistory.value.scrollHeight;
  if (pendingScrollRequestId.value === requestId) pendingScrollRequestId.value = "";
}

function conversationMessages(requestId: string) {
  return activeRequestId.value === requestId ? (conversation.messagesQuery.data.value ?? []) : [];
}

const activeAccessGrant = computed(() => {
  const grants = conversationMessages(activeRequestId.value).flatMap((item) =>
    item.accessGrant ? [item.accessGrant] : [],
  );
  return grants.find((grant) => grant.active) ?? grants[grants.length - 1] ?? null;
});

function unreadCount(requestId: string) {
  return unread.data.value?.requests.find((item) => item.requestId === requestId)?.unreadCount ?? 0;
}

async function sendReply() {
  replyError.value = "";
  if (replyText.value.length > 1000) {
    replyError.value = "Сообщение не должно превышать 1000 символов.";
    return;
  }
  replySending.value = true;
  try {
    await conversation.send(replyText.value, replyFiles.value);
    replyText.value = "";
    replyFiles.value = [];
  } catch (error) {
    replyError.value = error instanceof Error ? error.message : "Не удалось отправить сообщение";
  } finally {
    replySending.value = false;
  }
}

async function approveAccess(messageId: string) {
  await conversation.approveAccess(messageId);
}

function selectReplyFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const incoming = Array.from(input.files ?? []);
  input.value = "";
  replyError.value = "";
  for (const file of incoming) {
    if (file.size > MAX_SUPPORT_FILE_BYTES) {
      replyError.value = `Файл «${file.name}» превышает 20 МБ.`;
      continue;
    }
    const attachedCount =
      requests.requestsQuery.data.value?.find((request) => request.id === activeRequestId.value)
        ?.attachments.length ?? 0;
    if (attachedCount + replyFiles.value.length >= MAX_SUPPORT_FILE_COUNT) {
      replyError.value = "К одному обращению можно приложить не более пяти файлов.";
      break;
    }
    if (
      !replyFiles.value.some(
        (existing) => existing.name === file.name && existing.size === file.size,
      )
    )
      replyFiles.value.push(file);
  }
}

function selectFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const incoming = Array.from(input.files ?? []);
  input.value = "";
  fileSelectionError.value = "";

  const nextFiles = [...selectedFiles.value];
  for (const file of incoming) {
    if (
      nextFiles.some(
        (item) =>
          item.name === file.name &&
          item.size === file.size &&
          item.lastModified === file.lastModified,
      )
    ) {
      continue;
    }
    if (file.size > MAX_SUPPORT_FILE_BYTES) {
      fileSelectionError.value = `Файл «${file.name}» превышает 20 МБ.`;
      continue;
    }
    if (nextFiles.length >= MAX_SUPPORT_FILE_COUNT) {
      fileSelectionError.value = "Можно приложить не более пяти файлов.";
      break;
    }
    nextFiles.push(file);
  }
  selectedFiles.value = nextFiles;
}

function removeFile(index: number) {
  selectedFiles.value = selectedFiles.value.filter((_, fileIndex) => fileIndex !== index);
  fileSelectionError.value = "";
}

function chooseFile(): void {
  fileInput.value?.click();
}

async function revokeGrant(grantId: string) {
  if (!window.confirm("Отозвать доступ? Активная служебная сессия завершится.")) return;
  try {
    await requests.revokeGrant(grantId);
  } catch (error) {
    formError.value = error instanceof Error ? error.message : "Не удалось отозвать доступ";
  }
}

async function submit() {
  submitAttempted.value = true;
  formError.value = "";
  if (!reason.value) {
    formError.value = "Выберите причину обращения.";
    return;
  }
  if (message.value.length > 1000) {
    formError.value = "Сообщение не должно превышать 1000 символов.";
    return;
  }
  sending.value = true;
  try {
    const input: SupportControllerCreateBody = {
      reason: reason.value as SupportControllerCreateBody["reason"],
      message: message.value,
      browser: typeof navigator === "undefined" ? undefined : navigator.userAgent.slice(0, 200),
      companyId: props.workspace.company.id,
      venueId: props.workspace.venue.id,
      files: selectedFiles.value.length ? selectedFiles.value : undefined,
    };
    await requests.create(input);
    reason.value = "";
    submitAttempted.value = false;
    message.value = "";
    selectedFiles.value = [];
    fileSelectionError.value = "";
  } catch (error) {
    formError.value = error instanceof Error ? error.message : "Не удалось отправить обращение";
  } finally {
    sending.value = false;
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

function formatBytes(value: number): string {
  const formatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
  return value < 1024 * 1024
    ? `${Math.ceil(value / 1024)} КБ`
    : `${formatter.format(value / 1024 / 1024)} МБ`;
}

function formatRequestDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}

function toggleRequest(requestId: string): void {
  if (replySending.value) return;
  expandedRows.value = expandedRows.value[requestId] ? {} : { [requestId]: true };
}

function onRequestRowKeydown(event: {
  originalEvent: KeyboardEvent;
  data: SupportRequestResponseDto;
}): void {
  if (event.originalEvent.code !== "Enter" && event.originalEvent.code !== "Space") return;
  event.originalEvent.preventDefault();
  toggleRequest(event.data.id);
}

useSeoMeta({ title: "Обращение в техподдержку — IndieBar", robots: "noindex, nofollow" });
</script>

<style scoped>
.support-message-limit-invalid {
  border-color: var(--p-textarea-invalid-border-color) !important;
}

.support-message-bubble--customer {
  background-color: color-mix(in srgb, var(--p-primary-100) 70%, var(--p-content-background));
}

.support-message-bubble--support {
  background-color: var(--p-content-border-color);
}

:deep(.support-requests-table .p-datatable-row-expansion:hover > td) {
  background: var(--p-content-background);
}

:deep(.support-requests-table .p-datatable-tbody > tr:last-child > td) {
  border-bottom: 0;
}

:deep(.support-requests-table .p-datatable-thead > tr:first-child > th:first-child) {
  border-top-left-radius: var(--p-border-radius-md);
}

:deep(.support-requests-table .p-datatable-thead > tr:first-child > th:last-child) {
  border-top-right-radius: var(--p-border-radius-md);
}

:deep(.support-requests-table .p-datatable-tbody > tr:last-child > td:first-child) {
  border-bottom-left-radius: var(--p-border-radius-md);
}

:deep(.support-requests-table .p-datatable-tbody > tr:last-child > td:last-child) {
  border-bottom-right-radius: var(--p-border-radius-md);
}
</style>
