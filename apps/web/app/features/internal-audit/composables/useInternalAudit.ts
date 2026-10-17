import { computed, type Ref } from "vue";
import { useInfiniteQuery } from "@tanstack/vue-query";
import { internalAuditControllerList } from "@bartech/api-client";
import type { InternalAuditPageDto } from "@bartech/api-client";
import { requestApi } from "~/utils/api-response";

export function useInternalAudit(enabled: Ref<boolean>) {
  const apiFetch = useApiFetch();
  const query = useInfiniteQuery({
    queryKey: ["internal-audit-events"] as const,
    enabled,
    initialPageParam: undefined as string | undefined,
    retry: false,
    queryFn: async ({ pageParam, signal }) =>
      requestApi<InternalAuditPageDto>(
        internalAuditControllerList(
          { limit: 50, cursor: pageParam },
          { credentials: "include", signal },
          apiFetch,
        ),
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  return {
    query,
    items: computed(() => query.data.value?.pages.flatMap((page) => page.items) ?? []),
  };
}
