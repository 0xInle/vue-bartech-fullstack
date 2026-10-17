import { computed, onScopeDispose, ref, watch, type Ref } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  identityControllerCsrf,
  internalCatalogControllerCreateGlobal,
  internalCatalogControllerKeepLocal,
  internalCatalogControllerLink,
  internalCatalogControllerList,
  internalCatalogControllerSearch,
  internalCatalogControllerCategories,
} from "@bartech/api-client";
import type { CreateGlobalIngredientFromCandidateDto } from "@bartech/api-client";

const PAGE_SIZE = 25;

export function useInternalCatalog(enabled: Ref<boolean>) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  const page = ref(0);
  const searchText = ref("");
  const debouncedSearch = ref("");
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  watch(searchText, (value) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => (debouncedSearch.value = value.trim()), 300);
  });
  onScopeDispose(() => clearTimeout(searchTimer));
  const candidatesQuery = useQuery({
    queryKey: computed(() => ["internal-catalog-candidates", page.value]),
    enabled,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await internalCatalogControllerList(
        { offset: page.value * PAGE_SIZE, limit: PAGE_SIZE },
        { credentials: "include", signal },
        apiFetch,
      );
      return unwrap(response);
    },
  });
  const searchQuery = useQuery({
    queryKey: computed(() => ["internal-catalog-global-search", debouncedSearch.value]),
    enabled: computed(() => enabled.value && debouncedSearch.value.length >= 2),
    retry: false,
    queryFn: async ({ signal }) =>
      unwrap(
        await internalCatalogControllerSearch(
          { query: debouncedSearch.value, offset: 0, limit: 20 },
          { credentials: "include", signal },
          apiFetch,
        ),
      ),
  });

  async function resolve(action: () => Promise<unknown>, candidateId: string) {
    try {
      await action();
      page.value = 0;
      await refreshCandidates(candidateId);
    } catch (error) {
      if (isCandidateUnavailable(error)) {
        page.value = 0;
        await refreshCandidates(candidateId);
      }
      throw error;
    }
  }

  async function refreshCandidates(candidateId: string) {
    await queryClient.invalidateQueries({ queryKey: ["internal-catalog-candidates"] });
    await queryClient.invalidateQueries({ queryKey: ["internal-catalog-global-search"] });
    await queryClient.invalidateQueries({
      queryKey: ["api", "v1", "internal", "catalog", "candidates", candidateId],
    });
  }

  async function link(candidateId: string, globalProductId: string) {
    await resolve(async () => {
      const options = await mutationOptions();
      unwrap(
        await internalCatalogControllerLink(candidateId, { globalProductId }, options, apiFetch),
      );
    }, candidateId);
  }

  async function createGlobal(candidateId: string, input: CreateGlobalIngredientFromCandidateDto) {
    await resolve(async () => {
      const options = await mutationOptions();
      unwrap(await internalCatalogControllerCreateGlobal(candidateId, input, options, apiFetch));
    }, candidateId);
  }

  async function keepLocal(candidateId: string) {
    await resolve(async () => {
      const options = await mutationOptions();
      unwrap(await internalCatalogControllerKeepLocal(candidateId, options, apiFetch));
    }, candidateId);
  }

  async function mutationOptions(): Promise<RequestInit> {
    const csrf = unwrap(await identityControllerCsrf({ credentials: "include" }, apiFetch));
    return { credentials: "include", headers: { "x-csrf-token": csrf.token } };
  }

  async function loadCategories() {
    return unwrap(await internalCatalogControllerCategories({ credentials: "include" }, apiFetch));
  }

  return {
    candidatesQuery,
    searchText,
    searchQuery,
    page,
    pageSize: PAGE_SIZE,
    link,
    createGlobal,
    keepLocal,
    loadCategories,
  };
}

function unwrap<T>(response: { status: number; data: T }): T {
  if (response.status < 200 || response.status >= 300) {
    const data = response.data as { detail?: string; code?: string; message?: string } | undefined;
    const error = new Error(data?.detail ?? data?.message ?? "Не удалось выполнить запрос");
    Object.assign(error, { status: response.status, code: data?.code });
    throw error;
  }
  return response.data;
}

function isCandidateUnavailable(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && error.code === "CATALOG_CANDIDATE_UNAVAILABLE"
  );
}
