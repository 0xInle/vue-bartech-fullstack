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
      query.state.data?.some((request) => request.attachment?.status === "pending_scan")
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

  async function download(requestId: string): Promise<void> {
    const result = await requestApi<{ url: string }>(
      supportControllerDownload(requestId, { credentials: "include" }, identity.apiFetch),
    );
    window.location.assign(result.url);
  }

  return { requestsQuery, create, download };
}
