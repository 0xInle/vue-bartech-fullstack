import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  productsControllerArchiveProduct,
  productsControllerGetArchiveCard,
  productsControllerGetArchiveRestorePlan,
  productsControllerListArchive,
  productsControllerRestoreProduct,
} from "@bartech/api-client";
import type { ProductAnalyticsEventDto } from "@bartech/api-client";
import type {
  productsControllerGetArchiveCardResponse200,
  productsControllerGetArchiveRestorePlanResponse200,
  productsControllerListArchiveResponse200,
  productsControllerArchiveProductResponse409,
  ProductsControllerRestoreProductMutationBody,
} from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";
import { useProductAnalytics } from "~/features/analytics/composables/useProductAnalytics";

export type ArchiveCard = productsControllerGetArchiveCardResponse200["data"];
export type ArchivePlan = productsControllerGetArchiveRestorePlanResponse200["data"];
export type ArchiveItem = productsControllerListArchiveResponse200["data"][number];
export type RestoreInput = ProductsControllerRestoreProductMutationBody;
export type ProductAnalyticsType = NonNullable<ProductAnalyticsEventDto["productType"]>;
type ArchiveProblem = productsControllerArchiveProductResponse409["data"] & { detail?: string };

export class ArchiveRequestError extends Error {
  constructor(readonly problem: ArchiveProblem) {
    super(problem.detail ?? "Не удалось выполнить действие. Попробуйте ещё раз.");
  }
}

async function archiveResponse<T>(response: { status: number; data: unknown }): Promise<T> {
  if (response.status < 200 || response.status >= 300)
    throw new ArchiveRequestError(response.data as ArchiveProblem);
  return response.data as T;
}

export function useProductArchive(
  companyId: MaybeRefOrGetter<string>,
  venueId: MaybeRefOrGetter<string>,
) {
  const identity = useIdentityFlow();
  const analytics = useProductAnalytics();
  const queryClient = useQueryClient();
  const company = computed(() => toValue(companyId));
  const venue = computed(() => toValue(venueId));
  const enabled = computed(() => Boolean(company.value && venue.value));

  function list(
    query: MaybeRefOrGetter<string>,
    type: MaybeRefOrGetter<ArchiveItem["type"] | undefined>,
  ) {
    return useQuery({
      queryKey: computed(() => [
        "product-archive-list",
        company.value,
        venue.value,
        toValue(query),
        toValue(type),
      ]),
      enabled,
      retry: false,
      queryFn: async ({ signal }) =>
        requestApi<ArchiveItem[]>(
          productsControllerListArchive(
            company.value,
            venue.value,
            { query: toValue(query) || undefined, type: toValue(type) },
            { credentials: "include", signal },
            identity.apiFetch,
          ),
        ),
    });
  }

  function card(productId: MaybeRefOrGetter<string>) {
    return useQuery({
      queryKey: computed(() => [
        "product-archive-card",
        company.value,
        venue.value,
        toValue(productId),
      ]),
      enabled: computed(() => enabled.value && Boolean(toValue(productId))),
      retry: false,
      queryFn: async ({ signal }) => {
        const product = await requestApi<ArchiveCard>(
          productsControllerGetArchiveCard(
            company.value,
            venue.value,
            toValue(productId),
            { credentials: "include", signal },
            identity.apiFetch,
          ),
        );
        void analytics.track({ eventType: "PRODUCT_OPENED", productType: product.type });
        return product;
      },
    });
  }

  async function invalidate(currentCompany: string, currentVenue: string) {
    const prefixes = new Set([
      "product-archive-list",
      "product-archive-card",
      "cocktail-list",
      "cocktail-card",
      "preparation-list",
      "preparation-card",
      "garnish-list",
      "garnish-card",
      "cocktail-garnishes",
      "product-search",
      "archive-ingredient-options",
    ]);
    await queryClient.invalidateQueries({
      refetchType: "none",
      predicate: ({ queryKey }) =>
        prefixes.has(String(queryKey[0])) &&
        queryKey[1] === currentCompany &&
        queryKey[2] === currentVenue,
    });
  }

  async function archive(productId: string, productType: ProductAnalyticsType) {
    const currentCompany = company.value;
    const currentVenue = venue.value;
    await identity.refreshCsrf();
    const result = await archiveResponse(
      await productsControllerArchiveProduct(
        currentCompany,
        currentVenue,
        productId,
        { credentials: "include", headers: { "x-csrf-token": identity.csrfToken.value } },
        identity.apiFetch,
      ),
    );
    await invalidate(currentCompany, currentVenue);
    void analytics.track({ eventType: "PRODUCT_ARCHIVED", productType });
    return result;
  }

  async function restorePlan(productId: string) {
    return requestApi<ArchivePlan>(
      productsControllerGetArchiveRestorePlan(
        company.value,
        venue.value,
        productId,
        { credentials: "include" },
        identity.apiFetch,
      ),
    );
  }

  async function restore(
    productId: string,
    input: RestoreInput,
    productType: ProductAnalyticsType,
  ) {
    const currentCompany = company.value;
    const currentVenue = venue.value;
    await identity.refreshCsrf();
    await archiveResponse(
      await productsControllerRestoreProduct(
        currentCompany,
        currentVenue,
        productId,
        input,
        { credentials: "include", headers: { "x-csrf-token": identity.csrfToken.value } },
        identity.apiFetch,
      ),
    );
    await invalidate(currentCompany, currentVenue);
    void analytics.track({ eventType: "PRODUCT_RESTORED", productType });
  }

  return { list, card, archive, restorePlan, restore };
}
