import { computed, onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import { useQuery } from "@tanstack/vue-query";
import {
  companyProductsControllerSearchCompany,
  productsControllerSearchWorkspace,
} from "@bartech/api-client";
import type { ProductSearchPageResponseDto } from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { useProductAnalytics } from "~/features/analytics/composables/useProductAnalytics";
import type { Workspace } from "~/types/user-workspaces";
import { requestApi } from "~/utils/api-response";

export type WorkspaceSearchItem = ProductSearchPageResponseDto["items"][number];
export type WorkspaceSearchScope = "VENUE" | "COMPANY";

export function useWorkspaceProductSearch(workspace: MaybeRefOrGetter<Workspace>) {
  const identity = useIdentityFlow();
  const analytics = useProductAnalytics();
  const searchText = ref("");
  const debouncedSearch = ref("");
  const scope = ref<WorkspaceSearchScope>("VENUE");
  const limit = 20;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  const currentWorkspace = computed(() => toValue(workspace));
  const isChef = computed(() => currentWorkspace.value.role === "chef_bartender");
  const queryEnabled = computed(() => debouncedSearch.value.length >= 2);
  watch(
    searchText,
    (value) => {
      clearTimeout(searchTimer);
      const normalized = value.trim().slice(0, 160);
      if (normalized.length < 2) {
        debouncedSearch.value = normalized;
        return;
      }
      searchTimer = setTimeout(() => (debouncedSearch.value = normalized), 300);
    },
    { flush: "sync" },
  );
  watch(isChef, (allowed) => {
    if (!allowed) scope.value = "VENUE";
  });
  onScopeDispose(() => clearTimeout(searchTimer));

  const productQuery = useQuery({
    queryKey: computed(() => [
      "workspace-product-search",
      currentWorkspace.value.company.id,
      currentWorkspace.value.venue.id,
      currentWorkspace.value.role,
      isChef.value ? scope.value : "VENUE",
      debouncedSearch.value,
    ]),
    enabled: queryEnabled,
    retry: false,
    queryFn: async ({ signal }): Promise<ProductSearchPageResponseDto> => {
      const params = {
        query: debouncedSearch.value,
        limit,
      };
      const response =
        isChef.value && scope.value === "COMPANY"
          ? await companyProductsControllerSearchCompany(
              currentWorkspace.value.company.id,
              params,
              { credentials: "include", signal },
              identity.apiFetch,
            )
          : await productsControllerSearchWorkspace(
              currentWorkspace.value.company.id,
              currentWorkspace.value.venue.id,
              params,
              { credentials: "include", signal },
              identity.apiFetch,
            );
      const page = await requestApi<ProductSearchPageResponseDto>(Promise.resolve(response));
      if (
        !page ||
        typeof page !== "object" ||
        !Array.isArray(page.items) ||
        !Number.isInteger(page.totalRecords) ||
        !Array.isArray(page.categories)
      ) {
        throw new Error("Сервер вернул ответ поиска в неподдерживаемом формате");
      }
      await analytics.track({ eventType: "SEARCH_USED" });
      if (page.totalRecords === 0) await analytics.track({ eventType: "SEARCH_EMPTY" });
      return page;
    },
  });

  return {
    debouncedSearch,
    productQuery,
    scope,
    searchText,
  };
}
