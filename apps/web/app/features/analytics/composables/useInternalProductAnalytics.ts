import { computed, type Ref } from "vue";
import { internalAnalyticsControllerList } from "@bartech/api-client";
import type { InternalAnalyticsControllerList200 } from "@bartech/api-client";
import { useQuery } from "@tanstack/vue-query";
import { requestApi } from "~/utils/api-response";

export function useInternalProductAnalytics(days: Ref<number>, enabled: Ref<boolean>) {
  const apiFetch = useApiFetch();
  const query = useQuery({
    queryKey: computed(() => ["internal-product-analytics", days.value]),
    enabled,
    retry: false,
    queryFn: () =>
      requestApi<InternalAnalyticsControllerList200>(
        internalAnalyticsControllerList({ days: days.value }, { credentials: "include" }, apiFetch),
      ),
  });

  return { query };
}
