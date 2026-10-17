import { computed, type Ref } from "vue";
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
      query.state.data?.items.some((request) => request.attachment?.status === "pending_scan")
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

  async function download(requestId: string) {
    const result = await requestApi<{ url: string }>(
      internalSupportControllerDownload(requestId, { credentials: "include" }, apiFetch),
    );
    window.location.assign(result.url);
  }

  return { queueQuery, usersQuery, update, download };
}
