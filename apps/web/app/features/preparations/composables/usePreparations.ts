import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  productsControllerCreateIngredient,
  productsControllerCreatePreparation,
  productsControllerGetPreparation,
  productsControllerGetReferences,
  productsControllerListPreparations,
  productsControllerUpdatePreparation,
} from "@bartech/api-client";
import type {
  ProductsControllerCreateIngredientMutationBody as CreateLocalIngredientDto,
  ProductsControllerCreatePreparationMutationBody as CreatePreparationDto,
  ProductsControllerUpdatePreparationMutationBody as UpdatePreparationDto,
  productsControllerCreatePreparationResponse201,
  productsControllerGetPreparationResponse200,
  productsControllerGetReferencesResponse200,
  productsControllerListPreparationsResponse200,
  productsControllerUpdatePreparationResponse200,
  productsControllerUpdatePreparationResponse409,
} from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";
import { scopedProductApiFetch } from "~/features/products/composables/scopedProductApiFetch";
import { useProductAnalytics } from "~/features/analytics/composables/useProductAnalytics";

export type PreparationCardResponseDto = productsControllerGetPreparationResponse200["data"];
type PreparationListItemResponseDto = productsControllerListPreparationsResponse200["data"][number];
type ProductCreatedDto = productsControllerCreatePreparationResponse201["data"];
type ProductReferencesResponseDto = productsControllerGetReferencesResponse200["data"];
type UpdatedPreparationDto = productsControllerUpdatePreparationResponse200["data"];
export type PreparationImpact = productsControllerUpdatePreparationResponse409["data"];
export type PreparationUpdateResult =
  | { kind: "saved"; preparation: UpdatedPreparationDto }
  | { kind: "confirmation"; impact: PreparationImpact };

export function usePreparations(
  companyId: MaybeRefOrGetter<string>,
  venueId: MaybeRefOrGetter<string>,
  options: { serviceSessionId?: string; enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  const route = useRoute();
  const router = useRouter();
  const identity = useIdentityFlow();
  const analytics = useProductAnalytics();
  const queryClient = useQueryClient();
  const company = computed(() => toValue(companyId));
  const venue = computed(() => toValue(venueId));
  const productApiFetch = options.serviceSessionId
    ? scopedProductApiFetch(
        identity.apiFetch,
        `/api/v1/internal/service-sessions/${options.serviceSessionId}/companies/${company.value}/venues/${venue.value}/products`,
      )
    : identity.apiFetch;
  const searchText = ref(readQuery(route.query.query));
  const categoryCode = ref(readQuery(route.query.category));
  const hasWorkspace = computed(() =>
    Boolean(company.value && venue.value && toValue(options.enabled ?? true)),
  );
  const normalizedSearch = computed(() => searchText.value.trim());
  const listKey = computed(() => [
    "preparation-list",
    company.value,
    venue.value,
    options.serviceSessionId ?? "client",
    normalizedSearch.value,
    categoryCode.value,
  ]);
  const referencesKey = computed(() => [
    "product-references",
    company.value,
    venue.value,
    options.serviceSessionId ?? "client",
  ]);

  watch(
    () => route.query,
    (query) => {
      searchText.value = readQuery(query.query);
      categoryCode.value = readQuery(query.category);
    },
  );
  watch(
    [searchText, categoryCode],
    () => {
      const next = { ...route.query } as Record<string, string | undefined>;
      assignQuery(next, "query", normalizedSearch.value);
      assignQuery(next, "category", categoryCode.value);
      delete next.sort;
      if (!sameQuery(route.query, next)) void router.replace({ query: next });
    },
    { immediate: true },
  );

  const listQuery = useQuery({
    queryKey: listKey,
    enabled: hasWorkspace,
    retry: false,
    queryFn: async ({ signal }): Promise<PreparationListItemResponseDto[]> =>
      requestApi(
        Promise.resolve(
          await productsControllerListPreparations(
            company.value,
            venue.value,
            {
              query: normalizedSearch.value || undefined,
              categoryCode: categoryCode.value || undefined,
            },
            { credentials: "include", signal },
            productApiFetch,
          ),
        ),
      ),
  });
  const referencesQuery = useQuery({
    queryKey: referencesKey,
    enabled: hasWorkspace,
    retry: false,
    queryFn: async ({ signal }): Promise<ProductReferencesResponseDto> =>
      requestApi(
        Promise.resolve(
          await productsControllerGetReferences(
            company.value,
            venue.value,
            { credentials: "include", signal },
            productApiFetch,
          ),
        ),
      ),
  });
  function preparationQuery(preparationId: MaybeRefOrGetter<string>) {
    return useQuery({
      queryKey: computed(() => [
        "preparation-card",
        company.value,
        venue.value,
        options.serviceSessionId ?? "client",
        toValue(preparationId),
      ]),
      enabled: computed(() => hasWorkspace.value && Boolean(toValue(preparationId))),
      retry: false,
      queryFn: async ({ signal }): Promise<PreparationCardResponseDto> => {
        const product = await requestApi(
          Promise.resolve(
            await productsControllerGetPreparation(
              company.value,
              venue.value,
              toValue(preparationId),
              { credentials: "include", signal },
              productApiFetch,
            ),
          ),
        );
        if (!options.serviceSessionId)
          void analytics.track({ eventType: "PRODUCT_OPENED", productType: "PREPARATION" });
        return product;
      },
    });
  }
  async function createPreparation(input: CreatePreparationDto): Promise<ProductCreatedDto> {
    if (!options.serviceSessionId)
      void analytics.track({ eventType: "PRODUCT_CREATE_STARTED", productType: "PREPARATION" });
    await identity.refreshCsrf();
    const created = await requestApi<ProductCreatedDto>(
      Promise.resolve(
        await productsControllerCreatePreparation(
          company.value,
          venue.value,
          input,
          { credentials: "include", headers: { "x-csrf-token": identity.csrfToken.value } },
          productApiFetch,
        ),
      ),
    );
    if (!options.serviceSessionId)
      void analytics.track({ eventType: "PRODUCT_CREATE_COMPLETED", productType: "PREPARATION" });
    await queryClient.invalidateQueries({
      queryKey: ["preparation-list", company.value, venue.value],
    });
    await queryClient.invalidateQueries({
      queryKey: [
        "preparation-card",
        company.value,
        venue.value,
        options.serviceSessionId ?? "client",
        created.id,
      ],
    });
    return created;
  }
  async function updatePreparation(
    preparationId: string,
    input: UpdatePreparationDto,
  ): Promise<PreparationUpdateResult> {
    await identity.refreshCsrf();
    const response = await productsControllerUpdatePreparation(
      company.value,
      venue.value,
      preparationId,
      input,
      { credentials: "include", headers: { "x-csrf-token": identity.csrfToken.value } },
      productApiFetch,
    );
    if (response.status === 409 && isPreparationImpact(response.data)) {
      return { kind: "confirmation", impact: response.data };
    }
    const preparation = await requestApi<UpdatedPreparationDto>(Promise.resolve(response));
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["preparation-list", company.value, venue.value],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "preparation-card",
          company.value,
          venue.value,
          options.serviceSessionId ?? "client",
          preparationId,
        ],
      }),
    ]);
    return { kind: "saved", preparation };
  }
  async function createLocalIngredient(
    input: CreateLocalIngredientDto,
  ): Promise<ProductCreatedDto> {
    if (!options.serviceSessionId)
      void analytics.track({ eventType: "PRODUCT_CREATE_STARTED", productType: "INGREDIENT" });
    await identity.refreshCsrf();
    const created = await requestApi<ProductCreatedDto>(
      Promise.resolve(
        await productsControllerCreateIngredient(
          company.value,
          venue.value,
          input,
          { credentials: "include", headers: { "x-csrf-token": identity.csrfToken.value } },
          productApiFetch,
        ),
      ),
    );
    if (!options.serviceSessionId)
      void analytics.track({ eventType: "PRODUCT_CREATE_COMPLETED", productType: "INGREDIENT" });
    return created;
  }
  function rememberScroll(): void {
    if (import.meta.client)
      sessionStorage.setItem(scrollKey(company.value, venue.value), String(window.scrollY));
  }
  function restoreScroll(): void {
    if (!import.meta.client) return;
    const value = Number(sessionStorage.getItem(scrollKey(company.value, venue.value)));
    if (Number.isFinite(value) && value > 0) window.scrollTo({ top: value });
  }
  return {
    categoryCode,
    createLocalIngredient,
    createPreparation,
    listQuery,
    preparationQuery,
    referencesQuery,
    rememberScroll,
    restoreScroll,
    searchText,
    updatePreparation,
  };
}
function isPreparationImpact(value: unknown): value is PreparationImpact {
  if (!value || typeof value !== "object") return false;
  const impact = value as Partial<PreparationImpact>;
  return (
    impact.code === "PREPARATION_DEPENDENCIES_CONFIRMATION_REQUIRED" &&
    typeof impact.confirmationFingerprint === "string" &&
    Array.isArray(impact.affectedProducts) &&
    impact.affectedProducts.every(
      (product) =>
        product !== null &&
        typeof product === "object" &&
        typeof product.id === "string" &&
        typeof product.name === "string" &&
        ["PREPARATION", "GARNISH", "COCKTAIL"].includes(product.type),
    )
  );
}
function readQuery(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function assignQuery(query: Record<string, string | undefined>, key: string, value: string): void {
  if (value) query[key] = value;
  else delete query[key];
}
function sameQuery(
  current: Record<string, unknown>,
  next: Record<string, string | undefined>,
): boolean {
  const currentEntries = Object.entries(current).filter(([, value]) => typeof value === "string");
  const nextEntries = Object.entries(next).filter(([, value]) => value !== undefined);
  return (
    currentEntries.length === nextEntries.length &&
    currentEntries.every(([key, value]) => next[key] === value)
  );
}
function scrollKey(companyId: string, venueId: string): string {
  return `preparation-list-scroll:${companyId}:${venueId}`;
}
