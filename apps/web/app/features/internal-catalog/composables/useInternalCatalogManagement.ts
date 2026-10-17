import { computed, onScopeDispose, ref, watch, type Ref } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  identityControllerCsrf,
  internalCatalogControllerAddAlias,
  internalCatalogControllerConfirmAlias,
  internalCatalogControllerDeleteAlias,
  internalCatalogControllerGetManaged,
  internalCatalogControllerListManaged,
  internalCatalogControllerMerge,
  internalCatalogControllerPreviewMerge,
  internalCatalogControllerUpdateManaged,
} from "@bartech/api-client";
import type {
  CatalogMergePreviewDto,
  ConfirmCatalogMergeDto,
  CreateGlobalAliasDto,
  InternalCatalogControllerListManagedParams,
  UpdateGlobalIngredientDto,
} from "@bartech/api-client";

const PAGE_SIZE = 20;

export function useInternalCatalogManagement(enabled: Ref<boolean>) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  const page = ref(0);
  const status = ref<"ACTIVE" | "ALL">("ACTIVE");
  const searchText = ref("");
  const debouncedSearch = ref("");
  const selectedId = ref("");
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  watch(searchText, (value) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      debouncedSearch.value = value.trim();
      page.value = 0;
    }, 300);
  });
  onScopeDispose(() => clearTimeout(searchTimer));

  const params = computed<InternalCatalogControllerListManagedParams>(() => ({
    query: debouncedSearch.value,
    status: status.value,
    offset: page.value * PAGE_SIZE,
    limit: PAGE_SIZE,
  }));
  const listQuery = useQuery({
    queryKey: computed(() => [
      "api",
      "v1",
      "internal",
      "catalog",
      "manage",
      "ingredients",
      params.value,
    ]),
    enabled,
    retry: false,
    queryFn: async ({ signal }) =>
      unwrap(
        await internalCatalogControllerListManaged(
          params.value,
          { credentials: "include", signal },
          apiFetch,
        ),
      ),
  });
  const cardQuery = useQuery({
    queryKey: computed(() => [
      "api",
      "v1",
      "internal",
      "catalog",
      "manage",
      "ingredients",
      selectedId.value,
    ]),
    enabled: computed(() => enabled.value && Boolean(selectedId.value)),
    retry: false,
    queryFn: async ({ signal }) =>
      unwrap(
        await internalCatalogControllerGetManaged(
          selectedId.value,
          { credentials: "include", signal },
          apiFetch,
        ),
      ),
  });

  function select(productId: string) {
    selectedId.value = productId;
  }

  async function update(productId: string, input: UpdateGlobalIngredientDto) {
    const options = await mutationOptions();
    unwrap(await internalCatalogControllerUpdateManaged(productId, input, options, apiFetch));
    await refresh(productId);
  }

  async function addAlias(productId: string, input: CreateGlobalAliasDto) {
    const options = await mutationOptions();
    unwrap(await internalCatalogControllerAddAlias(productId, input, options, apiFetch));
    await refresh(productId);
  }

  async function confirmAlias(productId: string, aliasId: string) {
    const options = await mutationOptions();
    unwrap(await internalCatalogControllerConfirmAlias(productId, aliasId, options, apiFetch));
    await refresh(productId);
  }

  async function deleteAlias(productId: string, aliasId: string) {
    const options = await mutationOptions();
    unwrap(await internalCatalogControllerDeleteAlias(productId, aliasId, options, apiFetch));
    await refresh(productId);
  }

  async function previewMerge(input: CatalogMergePreviewDto) {
    const options = await mutationOptions();
    return unwrap(await internalCatalogControllerPreviewMerge(input, options, apiFetch));
  }

  async function merge(input: ConfirmCatalogMergeDto) {
    const options = await mutationOptions();
    const result = unwrap(await internalCatalogControllerMerge(input, options, apiFetch));
    selectedId.value = input.canonicalId;
    await refresh(input.canonicalId);
    return result;
  }

  async function refresh(productId: string) {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["api", "v1", "internal", "catalog", "manage", "ingredients"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["api", "v1", "internal", "catalog", "ingredients", "search"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["api", "v1", "internal", "catalog", "manage", "ingredients", productId],
      }),
    ]);
  }

  async function mutationOptions(): Promise<RequestInit> {
    const csrf = unwrap(await identityControllerCsrf({ credentials: "include" }, apiFetch));
    return { credentials: "include", headers: { "x-csrf-token": csrf.token } };
  }

  return {
    listQuery,
    cardQuery,
    page,
    pageSize: PAGE_SIZE,
    status,
    searchText,
    selectedId,
    select,
    refresh,
    update,
    addAlias,
    confirmAlias,
    deleteAlias,
    previewMerge,
    merge,
  };
}

type ApiResponse = { status: number; data: unknown };
type SuccessfulData<Response extends ApiResponse> = Response extends {
  status: infer Status;
  data: infer Data;
}
  ? Status extends 200 | 201 | 202 | 203 | 204 | 205
    ? Data
    : never
  : never;

function unwrap<Response extends ApiResponse>(response: Response): SuccessfulData<Response> {
  if (response.status < 200 || response.status >= 300) {
    const data = response.data as
      | { detail?: string; code?: string; message?: string | string[]; conflicts?: unknown[] }
      | undefined;
    const error = new Error(
      data?.detail ??
        (Array.isArray(data?.message) ? data.message.join(". ") : data?.message) ??
        "Не удалось выполнить запрос",
    );
    Object.assign(error, { status: response.status, code: data?.code, conflicts: data?.conflicts });
    throw error;
  }
  return response.data as SuccessfulData<Response>;
}
