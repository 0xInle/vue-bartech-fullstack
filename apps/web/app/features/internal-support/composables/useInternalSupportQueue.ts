import { computed, ref, type Ref } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  identityControllerCsrf,
  internalSupportControllerDownload,
  internalSupportControllerList,
  internalSupportControllerListInternalUsers,
  internalSupportControllerUpdate,
} from "@bartech/api-client";
import type {
  InternalSupportControllerListParams,
  SupportInternalUserResponseDto,
  SupportRequestQueuePageDto,
  UpdateSupportRequestDto,
} from "@bartech/api-client";
import { requestApi } from "~/utils/api-response";
import {
  readResponse,
  type SupportConversationMessage,
} from "~/features/support/composables/useSupportConversation";

export function useInternalSupportQueue(
  enabled: Ref<boolean>,
  status: Ref<string>,
  page: Ref<number>,
) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  const params = computed<InternalSupportControllerListParams>(() => ({
    status: status.value
      ? (status.value as InternalSupportControllerListParams["status"])
      : undefined,
    page: page.value,
  }));
  const queueQuery = useQuery<SupportRequestQueuePageDto>({
    queryKey: computed(() => ["internal-support", params.value]),
    enabled,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.items.some((request) =>
        request.attachments.some((attachment) => attachment.status === "pending_scan"),
      )
        ? 3_000
        : false,
    queryFn: async ({ signal }) =>
      requestApi(
        internalSupportControllerList(params.value, { credentials: "include", signal }, apiFetch),
      ),
  });
  const usersQuery = useQuery<SupportInternalUserResponseDto[]>({
    queryKey: ["internal-support-users"],
    enabled,
    retry: false,
    queryFn: async () =>
      requestApi(internalSupportControllerListInternalUsers({ credentials: "include" }, apiFetch)),
  });
  const unreadQuery = useQuery<{
    totalCount: number;
    requests: Array<{ requestId: string; unreadCount: number }>;
  }>({
    queryKey: ["internal-support-unread-count"],
    enabled,
    retry: false,
    refetchInterval: 60_000,
    queryFn: async ({ signal }) =>
      readResponse(
        await apiFetch("/api/v1/internal/support/requests/unread-count", {
          credentials: "include",
          signal,
        }),
      ),
  });

  async function update(requestId: string, input: UpdateSupportRequestDto) {
    const csrf = await requestApi<{ token: string }>(
      identityControllerCsrf({ credentials: "include" }, apiFetch),
    );
    await requestApi(
      internalSupportControllerUpdate(
        requestId,
        input,
        { credentials: "include", headers: { "x-csrf-token": csrf.token } },
        apiFetch,
      ),
    );
    await queryClient.invalidateQueries({ queryKey: ["internal-support"] });
  }

  async function download(requestId: string, attachmentId: string) {
    const result = await requestApi<{ url: string }>(
      internalSupportControllerDownload(
        requestId,
        attachmentId,
        { credentials: "include" },
        apiFetch,
      ),
    );
    window.location.assign(result.url);
  }

  const selectedRequestId = ref("");
  const messagesQuery = useQuery<SupportConversationMessage[]>({
    queryKey: computed(() => ["internal-support-messages", selectedRequestId.value]),
    enabled: computed(() => enabled.value && Boolean(selectedRequestId.value)),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.some((message) => message.accessGrant?.active) ? 60_000 : false,
    queryFn: async ({ signal }) =>
      readResponse(
        await apiFetch(`/api/v1/internal/support/requests/${selectedRequestId.value}/messages`, {
          credentials: "include",
          signal,
        }),
      ),
  });

  async function csrfHeaders() {
    const csrf = await requestApi<{ token: string }>(
      identityControllerCsrf({ credentials: "include" }, apiFetch),
    );
    return { "content-type": "application/json", "x-csrf-token": csrf.token };
  }

  async function sendMessage(requestId: string, message: string, requestAccess = false) {
    const response = await apiFetch(`/api/v1/internal/support/requests/${requestId}/messages`, {
      method: "POST",
      credentials: "include",
      headers: await csrfHeaders(),
      body: JSON.stringify({ message, requestAccess }),
    });
    await requestApi({ status: response.status, data: await response.json() });
    await queryClient.invalidateQueries({ queryKey: ["internal-support-unread-count"] });
    await queryClient.invalidateQueries({ queryKey: ["internal-support-messages"] });
    await queryClient.invalidateQueries({ queryKey: ["internal-support"] });
  }

  async function revokeAccess(requestId: string, grantId: string) {
    const response = await apiFetch(
      `/api/v1/internal/support/requests/${requestId}/access-grants/${grantId}/revoke`,
      {
        method: "POST",
        credentials: "include",
        headers: await csrfHeaders(),
      },
    );
    await requestApi({ status: response.status, data: await response.json() });
    await queryClient.invalidateQueries({ queryKey: ["internal-support-messages", requestId] });
  }

  async function markRead(requestId: string) {
    const last = messagesQuery.data.value?.at(-1);
    if (!last) return;
    const response = await apiFetch(
      `/api/v1/internal/support/requests/${requestId}/messages/read`,
      {
        method: "POST",
        credentials: "include",
        headers: await csrfHeaders(),
        body: JSON.stringify({ throughMessageId: last.id }),
      },
    );
    await requestApi({ status: response.status, data: await response.json() });
    await queryClient.invalidateQueries({ queryKey: ["internal-support-unread-count"] });
  }

  return {
    queueQuery,
    usersQuery,
    unreadQuery,
    update,
    download,
    messagesQuery,
    sendMessage,
    revokeAccess,
    markRead,
    selectedRequestId,
  };
}
