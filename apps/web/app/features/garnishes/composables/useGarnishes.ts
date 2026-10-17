import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  productsControllerCreateGarnish,
  productsControllerCreateIngredient,
  productsControllerGetGarnish,
  productsControllerGetReferences,
  productsControllerListGarnishes,
  productsControllerUpdateGarnish,
} from "@bartech/api-client";
import type {
  ProductsControllerCreateGarnishMutationBody as CreateGarnishDto,
  ProductsControllerCreateIngredientMutationBody as CreateLocalIngredientDto,
  productsControllerGetGarnishResponse200,
  productsControllerListGarnishesResponse200,
  productsControllerCreateGarnishResponse201,
  ProductsControllerUpdateGarnishMutationBody as UpdateGarnishDto,
  productsControllerGetReferencesResponse200,
  productsControllerUpdateGarnishResponse200,
  productsControllerUpdateGarnishResponse409,
} from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";
import { scopedProductApiFetch } from "~/features/products/composables/scopedProductApiFetch";
import { useProductAnalytics } from "~/features/analytics/composables/useProductAnalytics";

export type GarnishCardResponseDto = productsControllerGetGarnishResponse200["data"];
type GarnishListItemResponseDto = productsControllerListGarnishesResponse200["data"][number];
type ProductCreatedDto = productsControllerCreateGarnishResponse201["data"];
type ProductReferencesResponseDto = productsControllerGetReferencesResponse200["data"];
type UpdatedGarnishDto = productsControllerUpdateGarnishResponse200["data"];
export type GarnishImpact = productsControllerUpdateGarnishResponse409["data"];
export type GarnishUpdateResult =
  { kind: "saved"; garnish: UpdatedGarnishDto } | { kind: "confirmation"; impact: GarnishImpact };

export function useGarnishes(
  companyId: MaybeRefOrGetter<string>,
  venueId: MaybeRefOrGetter<string>,
  options: { list?: boolean; serviceSessionId?: string; enabled?: MaybeRefOrGetter<boolean> } = {},
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
  const sort = ref(readSort(route.query.sort));
  const hasWorkspace = computed(() =>
    Boolean(company.value && venue.value && toValue(options.enabled ?? true)),
  );
  const normalizedSearch = computed(() => searchText.value.trim());
  const listKey = computed(() => [
    "garnish-list",
    company.value,
    venue.value,
    options.serviceSessionId ?? "client",
    normalizedSearch.value,
    sort.value,
  ]);
  const referencesKey = computed(() => [
    "product-references",
    company.value,
    venue.value,
    options.serviceSessionId ?? "client",
  ]);

  if (options.list !== false) {
    watch(
      () => route.query,
      (query) => {
        searchText.value = readQuery(query.query);
        sort.value = readSort(query.sort);
      },
    );
    watch(
      [searchText, sort],
      () => {
        const next = { ...route.query };
        if (normalizedSearch.value) next.query = normalizedSearch.value;
        else delete next.query;
        if (sort.value === "updated") next.sort = sort.value;
        else delete next.sort;
        if (route.query.query !== next.query || route.query.sort !== next.sort)
          void router.replace({ query: next });
      },
      { immediate: true },
    );
  }

  const listQuery = useQuery({
    queryKey: listKey,
    enabled: computed(() => hasWorkspace.value && options.list !== false),
    retry: false,
    queryFn: async ({ signal }): Promise<GarnishListItemResponseDto[]> =>
      requestApi(
        Promise.resolve(
          await productsControllerListGarnishes(
            company.value,
            venue.value,
            { query: normalizedSearch.value || undefined, sort: sort.value },
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
  function garnishQuery(garnishId: MaybeRefOrGetter<string>) {
    return useQuery({
      queryKey: computed(() => [
        "garnish-card",
        company.value,
        venue.value,
        options.serviceSessionId ?? "client",
        toValue(garnishId),
      ]),
      enabled: computed(() => hasWorkspace.value && Boolean(toValue(garnishId))),
      retry: false,
      queryFn: async ({ signal }): Promise<GarnishCardResponseDto> => {
        const product = await requestApi(
          Promise.resolve(
            await productsControllerGetGarnish(
              company.value,
              venue.value,
              toValue(garnishId),
              { credentials: "include", signal },
              productApiFetch,
            ),
          ),
        );
        if (!options.serviceSessionId)
          void analytics.track({ eventType: "PRODUCT_OPENED", productType: "GARNISH" });
        return product;
      },
    });
  }
  async function createGarnish(input: CreateGarnishDto): Promise<ProductCreatedDto> {
    const currentCompany = company.value;
    const currentVenue = venue.value;
    if (!options.serviceSessionId)
      void analytics.track({ eventType: "PRODUCT_CREATE_STARTED", productType: "GARNISH" });
    await identity.refreshCsrf();
    const created = await requestApi<ProductCreatedDto>(
      Promise.resolve(
        await productsControllerCreateGarnish(
          currentCompany,
          currentVenue,
          input,
          { credentials: "include", headers: { "x-csrf-token": identity.csrfToken.value } },
          productApiFetch,
        ),
      ),
    );
    if (!options.serviceSessionId)
      void analytics.track({ eventType: "PRODUCT_CREATE_COMPLETED", productType: "GARNISH" });
    await queryClient.invalidateQueries({
      queryKey: ["garnish-list", currentCompany, currentVenue],
    });
    await queryClient.invalidateQueries({
      queryKey: [
        "garnish-card",
        currentCompany,
        currentVenue,
        options.serviceSessionId ?? "client",
        created.id,
      ],
    });
    return created;
  }
  async function updateGarnish(
    garnishId: string,
    input: UpdateGarnishDto,
  ): Promise<GarnishUpdateResult> {
    const currentCompany = company.value;
    const currentVenue = venue.value;
    await identity.refreshCsrf();
    const response = await productsControllerUpdateGarnish(
      currentCompany,
      currentVenue,
      garnishId,
      input,
      { credentials: "include", headers: { "x-csrf-token": identity.csrfToken.value } },
      productApiFetch,
    );
    if (response.status === 409 && isGarnishImpact(response.data)) {
      return { kind: "confirmation", impact: response.data };
    }
    const garnish = await requestApi<UpdatedGarnishDto>(Promise.resolve(response));
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["garnish-list", currentCompany, currentVenue],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "garnish-card",
          currentCompany,
          currentVenue,
          options.serviceSessionId ?? "client",
          garnishId,
        ],
      }),
    ]);
    return { kind: "saved", garnish };
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
    const key = scrollKey(company.value, venue.value);
    const value = Number(sessionStorage.getItem(key));
    sessionStorage.removeItem(key);
    if (Number.isFinite(value) && value > 0) window.scrollTo({ top: value });
  }
  return {
    createGarnish,
    createLocalIngredient,
    garnishQuery,
    listKey,
    listQuery,
    referencesKey,
    referencesQuery,
    rememberScroll,
    restoreScroll,
    searchText,
    sort,
    updateGarnish,
  };
}
function isGarnishImpact(value: unknown): value is GarnishImpact {
  if (!value || typeof value !== "object") return false;
  const impact = value as Partial<GarnishImpact>;
  return (
    impact.code === "GARNISH_DEPENDENCIES_CONFIRMATION_REQUIRED" &&
    typeof impact.confirmationFingerprint === "string" &&
    Array.isArray(impact.affectedProducts) &&
    impact.affectedProducts.every(
      (product) =>
        product !== null &&
        typeof product === "object" &&
        typeof product.id === "string" &&
        typeof product.name === "string" &&
        product.type === "COCKTAIL",
    )
  );
}
function readQuery(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function readSort(value: unknown): "name" | "updated" {
  return value === "updated" ? "updated" : "name";
}
function scrollKey(companyId: string, venueId: string): string {
  return `garnish-list-scroll:${companyId}:${venueId}`;
}
