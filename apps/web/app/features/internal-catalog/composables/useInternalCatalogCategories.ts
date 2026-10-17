import { useQuery, useQueryClient } from "@tanstack/vue-query";
import type { Ref } from "vue";
import {
  identityControllerCsrf,
  internalCatalogControllerActivateCategory,
  internalCatalogControllerCreateCategory,
  internalCatalogControllerDeactivateCategory,
  internalCatalogControllerManagedCategories,
  internalCatalogControllerUpdateCategory,
} from "@bartech/api-client";
import type {
  CreateIngredientCategoryDto,
  IngredientCategoryManagementDto,
  UpdateIngredientCategoryDto,
} from "@bartech/api-client";

export function useInternalCatalogCategories(enabled: Ref<boolean>) {
  const apiFetch = useApiFetch();
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({
    queryKey: ["api", "v1", "internal", "catalog", "manage", "categories"],
    enabled,
    retry: false,
    queryFn: async ({ signal }) =>
      unwrap(
        await internalCatalogControllerManagedCategories(
          { credentials: "include", signal },
          apiFetch,
        ),
      ),
  });

  async function create(input: CreateIngredientCategoryDto) {
    const options = await mutationOptions();
    unwrap(await internalCatalogControllerCreateCategory(input, options, apiFetch));
    await refresh();
  }

  async function update(code: string, input: UpdateIngredientCategoryDto) {
    const options = await mutationOptions();
    unwrap(await internalCatalogControllerUpdateCategory(code, input, options, apiFetch));
    await refresh();
  }

  async function setActive(code: string, active: boolean) {
    const options = await mutationOptions();
    const response = active
      ? await internalCatalogControllerActivateCategory(code, options, apiFetch)
      : await internalCatalogControllerDeactivateCategory(code, options, apiFetch);
    unwrap(response);
    await refresh();
  }

  async function mutationOptions(): Promise<RequestInit> {
    const csrf = await identityControllerCsrf({ credentials: "include" }, apiFetch);
    if (csrf.status < 200 || csrf.status >= 300) throw new Error("Не удалось проверить запрос");
    return { credentials: "include", headers: { "x-csrf-token": csrf.data.token } };
  }

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["api", "v1", "internal", "catalog", "manage", "categories"],
      }),
      queryClient.invalidateQueries({ queryKey: ["internal-catalog-candidates"] }),
      queryClient.invalidateQueries({ queryKey: ["product-references"] }),
    ]);
  }

  return { categoriesQuery, create, update, setActive };
}

export type Category = IngredientCategoryManagementDto;

function unwrap<T>(response: { status: number; data: T }) {
  if (response.status < 200 || response.status >= 300) {
    const data = response.data as { detail?: string; message?: string | string[] } | undefined;
    throw new Error(
      data?.detail ??
        (Array.isArray(data?.message) ? data.message.join(". ") : data?.message) ??
        "Не удалось выполнить операцию",
    );
  }
  return response.data;
}
