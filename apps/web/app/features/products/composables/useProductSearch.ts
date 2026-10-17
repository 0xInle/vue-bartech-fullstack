import { computed, ref, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { productsControllerSearch } from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";
import { scopedProductApiFetch } from "./scopedProductApiFetch";
import { useProductAnalytics } from "~/features/analytics/composables/useProductAnalytics";
import {
  normalizeProductSearchItem,
  type ProductSearchItem,
  type ProductSearchItemResponse,
} from "../types";

export function useProductSearch(
  companyId: MaybeRefOrGetter<string>,
  venueId: MaybeRefOrGetter<string>,
  options: { serviceSessionId?: string; enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  const identity = useIdentityFlow();
  const analytics = useProductAnalytics();
  const searchText = ref("");
  const company = computed(() => toValue(companyId));
  const venue = computed(() => toValue(venueId));
  const productApiFetch = options.serviceSessionId
    ? scopedProductApiFetch(
        identity.apiFetch,
        `/api/v1/internal/service-sessions/${options.serviceSessionId}/companies/${company.value}/venues/${venue.value}/products`,
      )
    : identity.apiFetch;
  const normalizedQuery = computed(() => searchText.value.trim());
  const searchQuery = useQuery({
    queryKey: computed(() => [
      "product-search",
      company.value,
      venue.value,
      options.serviceSessionId ?? "client",
      normalizedQuery.value,
    ]),
    enabled: computed(() => normalizedQuery.value.length >= 2 && toValue(options.enabled ?? true)),
    retry: false,
    queryFn: async ({ signal }): Promise<ProductSearchItem[]> => {
      const response = await productsControllerSearch(
        company.value,
        venue.value,
        { query: normalizedQuery.value, scope: "COMPONENT" },
        { credentials: "include", signal },
        productApiFetch,
      );
      const items = (await requestApi<ProductSearchItemResponse[]>(Promise.resolve(response))).map(
        normalizeProductSearchItem,
      );
      if (!options.serviceSessionId) {
        void analytics.track({ eventType: "SEARCH_USED" });
        if (!items.length) void analytics.track({ eventType: "SEARCH_EMPTY" });
      }
      return items;
    },
  });

  return { searchText, searchQuery };
}
