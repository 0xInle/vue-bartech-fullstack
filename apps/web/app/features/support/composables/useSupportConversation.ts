import { computed, type Ref } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { identityControllerCsrf } from "@bartech/api-client";
import { requestApi } from "~/utils/api-response";

export type SupportConversationMessage = {
  id: string;
  authorType: "customer" | "internal";
  authorName: string;
  kind: "text" | "access_request";
  body: string;
  createdAt: string;
  attachments: Array<{ id: string; originalName: string; sizeBytes: number; status: string }>;
  accessGrant: {
    id: string;
    scopeType: string;
    companyName: string;
    venueName: string | null;
    expiresAt: string;
    revokedAt: string | null;
    active: boolean;
  } | null;
};

export function useSupportConversation(requestId: Ref<string>, enabled: Ref<boolean>) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  const queryKey = computed(() => ["support-messages", requestId.value]);
  const messagesQuery = useQuery<SupportConversationMessage[]>({
    queryKey,
    enabled,
    retry: false,
    queryFn: async ({ signal }) =>
      readResponse(
        await apiFetch(`/api/v1/support/requests/${requestId.value}/messages`, {
          credentials: "include",
          signal,
        }),
      ),
  });

  async function markRead() {
    const targetRequestId = requestId.value;
    const last = messagesQuery.data.value?.at(-1);
    if (!last) return;
    const csrf = await requestApi<{ token: string }>(
      identityControllerCsrf({ credentials: "include" }, apiFetch),
    );
    await apiFetch(`/api/v1/support/requests/${targetRequestId}/messages/read`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "x-csrf-token": csrf.token },
      body: JSON.stringify({ throughMessageId: last.id }),
    });
    await queryClient.invalidateQueries({ queryKey: ["support-unread-count"] });
  }

  async function send(message: string, files: File[] = []) {
    const targetRequestId = requestId.value;
    const targetQueryKey = ["support-messages", targetRequestId];
    const csrf = await requestApi<{ token: string }>(
      identityControllerCsrf({ credentials: "include" }, apiFetch),
    );
    const body = new FormData();
    if (message.trim()) body.set("message", message.trim());
    files.forEach((file) => body.append("files", file));
    await apiFetch(`/api/v1/support/requests/${targetRequestId}/messages`, {
      method: "POST",
      credentials: "include",
      headers: { "x-csrf-token": csrf.token },
      body,
    });
    await queryClient.invalidateQueries({ queryKey: targetQueryKey });
    await queryClient.invalidateQueries({ queryKey: ["support-requests"] });
    await queryClient.invalidateQueries({ queryKey: ["support-unread-count"] });
  }

  async function approveAccess(messageId: string) {
    const targetRequestId = requestId.value;
    const csrf = await requestApi<{ token: string }>(
      identityControllerCsrf({ credentials: "include" }, apiFetch),
    );
    await apiFetch(
      `/api/v1/support/access-grants/requests/${targetRequestId}/messages/${messageId}/approve-access`,
      { method: "POST", credentials: "include", headers: { "x-csrf-token": csrf.token } },
    );
    await queryClient.invalidateQueries({ queryKey: ["support-messages", targetRequestId] });
    await queryClient.invalidateQueries({ queryKey: ["support-access-grants"] });
  }

  return { messagesQuery, markRead, send, approveAccess };
}

export async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  return requestApi<T>({ status: response.status, data });
}
