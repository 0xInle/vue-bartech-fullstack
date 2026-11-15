import { computed } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  identityControllerCsrf,
  supportControllerCreate,
  supportControllerDownload,
  supportControllerList,
} from "@bartech/api-client";
import type { SupportControllerCreateBody, SupportRequestResponseDto } from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";

export function useSupportRequests() {
  const identity = useIdentityFlow();
  const queryClient = useQueryClient();
  const userId = computed(() => identity.currentUser.value?.id ?? "");
  const requestsQuery = useQuery<SupportRequestResponseDto[]>({
    queryKey: computed(() => ["support-requests", userId.value]),
    enabled: computed(() => Boolean(userId.value)),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.some((request) =>
        request.attachments.some((attachment) => attachment.status === "pending_scan"),
      )
        ? 3_000
        : false,
    queryFn: async ({ signal }): Promise<SupportRequestResponseDto[]> =>
      requestApi(
        Promise.resolve(
          await supportControllerList({ credentials: "include", signal }, identity.apiFetch),
        ),
      ),
  });

  async function create(input: SupportControllerCreateBody): Promise<void> {
    const csrf = await requestApi<{ token: string }>(
      identityControllerCsrf({ credentials: "include" }, identity.apiFetch),
    );
    await requestApi(
      supportControllerCreate(
        input,
        { credentials: "include", headers: { "x-csrf-token": csrf.token } },
        identity.apiFetch,
      ),
    );
    await queryClient.invalidateQueries({ queryKey: ["support-requests", userId.value] });
  }

  async function download(requestId: string, attachmentId: string): Promise<void> {
    const result = await requestApi<{ url: string }>(
      supportControllerDownload(
        requestId,
        attachmentId,
        { credentials: "include" },
        identity.apiFetch,
      ),
    );
    window.location.assign(result.url);
  }

  async function revokeGrant(grantId: string): Promise<void> {
    const csrf = await requestApi<{ token: string }>(
      identityControllerCsrf({ credentials: "include" }, identity.apiFetch),
    );
    const response = await identity.apiFetch(`/api/v1/support/access-grants/${grantId}/revoke`, {
      method: "POST",
      credentials: "include",
      headers: { "x-csrf-token": csrf.token },
    });
    await requestApi({ status: response.status, data: await response.json() });
    await queryClient.invalidateQueries({ queryKey: ["support-messages"] });
  }

  return { requestsQuery, create, download, revokeGrant };
}
