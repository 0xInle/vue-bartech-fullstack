import { computed, ref, toValue, watch, type MaybeRefOrGetter } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  productsControllerCreateCocktail,
  productsControllerCreateIngredient,
  productsControllerCreateReferenceValue,
  productsControllerGetCocktail,
  productsControllerGetReferences,
  productsControllerListCocktailGarnishes,
  productsControllerListCocktails,
  productsControllerUpdateCocktail,
} from "@bartech/api-client";
import type {
  ProductsControllerCreateCocktailMutationBody as CreateCocktailDto,
  ProductsControllerUpdateCocktailMutationBody as UpdateCocktailDto,
  ProductsControllerCreateIngredientMutationBody as CreateLocalIngredientDto,
  ProductsControllerCreateReferenceValueMutationBody as CreateLocalReferenceValueDto,
  productsControllerCreateCocktailResponse201,
  ReferenceValueResponseDto,
  productsControllerGetCocktailResponse200,
  productsControllerGetReferencesResponse200,
  productsControllerListCocktailGarnishesResponse200,
  productsControllerListCocktailsResponse200,
  productsControllerUpdateCocktailResponse200,
} from "@bartech/api-client";
import { useIdentityFlow } from "~/features/identity/composables/useIdentityFlow";
import { requestApi } from "~/utils/api-response";
import { scopedProductApiFetch } from "~/features/products/composables/scopedProductApiFetch";
import { useProductAnalytics } from "~/features/analytics/composables/useProductAnalytics";

export type CocktailCardResponseDto = productsControllerGetCocktailResponse200["data"];
type CocktailGarnishOptionResponseDto =
  productsControllerListCocktailGarnishesResponse200["data"][number];
type CocktailListItemResponseDto = productsControllerListCocktailsResponse200["data"][number];
type ProductCreatedDto = productsControllerCreateCocktailResponse201["data"];
type UpdatedCocktailDto = productsControllerUpdateCocktailResponse200["data"];
type ProductReferencesResponseDto = productsControllerGetReferencesResponse200["data"];

export function useCocktails(
  companyId: MaybeRefOrGetter<string>,
  venueId: MaybeRefOrGetter<string>,
  options: {
    serviceSessionId?: string;
    enabled?: MaybeRefOrGetter<boolean>;
    categoryFilter?: boolean;
  } = {},
) {
  const identity = useIdentityFlow();
  const route = useRoute();
  const router = useRouter();
  const analytics = useProductAnalytics();
  const queryClient = useQueryClient();
  const searchText = ref(options.categoryFilter ? readQuery(route.query.query) : "");
  const categoryId = ref<string | null>(
    options.categoryFilter ? readQuery(route.query.category) || null : null,
  );
  const company = computed(() => toValue(companyId));
  const venue = computed(() => toValue(venueId));
  const productApiFetch = options.serviceSessionId
    ? scopedProductApiFetch(
        identity.apiFetch,
        `/api/v1/internal/service-sessions/${options.serviceSessionId}/companies/${company.value}/venues/${venue.value}/products`,
      )
    : identity.apiFetch;
  const normalizedSearch = computed(() => searchText.value.trim());
  const hasWorkspace = computed(() =>
    Boolean(company.value && venue.value && toValue(options.enabled ?? true)),
  );
  const listKey = computed(() => [
    "cocktail-list",
    company.value,
    venue.value,
    options.serviceSessionId ?? "client",
    normalizedSearch.value,
    categoryId.value,
  ]);
  const referencesKey = computed(() => [
    "product-references",
    company.value,
    venue.value,
    options.serviceSessionId ?? "client",
  ]);
  const garnishesKey = computed(() => [
    "cocktail-garnishes",
    company.value,
    venue.value,
    options.serviceSessionId ?? "client",
  ]);

  if (options.categoryFilter) {
    watch(
      () => [route.query.query, route.query.category],
      ([query, category]) => {
        searchText.value = readQuery(query);
        categoryId.value = readQuery(category) || null;
      },
    );
    watch(
      [normalizedSearch, categoryId],
      () => {
        const query = { ...route.query } as Record<string, string | undefined>;
        assignQuery(query, "query", normalizedSearch.value);
        assignQuery(query, "category", categoryId.value);
        if (
          Object.keys(query).length !== Object.keys(route.query).length ||
          Object.keys(query).some((key) => query[key] !== route.query[key])
        ) {
          void router.replace({ query });
        }
      },
      { immediate: true },
    );
  }

  const listQuery = useQuery({
    queryKey: listKey,
    enabled: hasWorkspace,
    retry: false,
    queryFn: async ({ signal }): Promise<CocktailListItemResponseDto[]> => {
      const response = await productsControllerListCocktails(
        company.value,
        venue.value,
        normalizedSearch.value || categoryId.value
          ? {
              query: normalizedSearch.value || undefined,
              categoryId: categoryId.value || undefined,
            }
          : undefined,
        { credentials: "include", signal },
        productApiFetch,
      );
      return requestApi<CocktailListItemResponseDto[]>(Promise.resolve(response));
    },
  });

  const referencesQuery = useQuery({
    queryKey: referencesKey,
    enabled: hasWorkspace,
    retry: false,
    queryFn: async ({ signal }): Promise<ProductReferencesResponseDto> => {
      const response = await productsControllerGetReferences(
        company.value,
        venue.value,
        { credentials: "include", signal },
        productApiFetch,
      );
      return requestApi<ProductReferencesResponseDto>(Promise.resolve(response));
    },
  });

  const garnishesQuery = useQuery({
    queryKey: garnishesKey,
    enabled: hasWorkspace,
    retry: false,
    queryFn: async ({ signal }): Promise<CocktailGarnishOptionResponseDto[]> => {
      const response = await productsControllerListCocktailGarnishes(
        company.value,
        venue.value,
        undefined,
        { credentials: "include", signal },
        productApiFetch,
      );
      return requestApi<CocktailGarnishOptionResponseDto[]>(Promise.resolve(response));
    },
  });

  function cocktailQuery(cocktailId: MaybeRefOrGetter<string>) {
    return useQuery({
      queryKey: computed(() => [
        "cocktail-card",
        company.value,
        venue.value,
        options.serviceSessionId ?? "client",
        toValue(cocktailId),
      ]),
      enabled: computed(() => hasWorkspace.value && Boolean(toValue(cocktailId))),
      retry: false,
      queryFn: async ({ signal }): Promise<CocktailCardResponseDto> => {
        const response = await productsControllerGetCocktail(
          company.value,
          venue.value,
          toValue(cocktailId),
          { credentials: "include", signal },
          productApiFetch,
        );
        const product = await requestApi<CocktailCardResponseDto>(Promise.resolve(response));
        if (!options.serviceSessionId)
          void analytics.track({ eventType: "PRODUCT_OPENED", productType: "COCKTAIL" });
        return product;
      },
    });
  }

  async function createCocktail(input: CreateCocktailDto): Promise<ProductCreatedDto> {
    if (!options.serviceSessionId)
      void analytics.track({ eventType: "PRODUCT_CREATE_STARTED", productType: "COCKTAIL" });
    await identity.refreshCsrf();
    const response = await productsControllerCreateCocktail(
      company.value,
      venue.value,
      input,
      {
        credentials: "include",
        headers: { "x-csrf-token": identity.csrfToken.value },
      },
      productApiFetch,
    );
    const created = await requestApi<ProductCreatedDto>(Promise.resolve(response));
    if (!options.serviceSessionId)
      void analytics.track({ eventType: "PRODUCT_CREATE_COMPLETED", productType: "COCKTAIL" });
    await queryClient.invalidateQueries({
      queryKey: ["cocktail-list", company.value, venue.value],
    });
    await queryClient.invalidateQueries({
      queryKey: [
        "cocktail-card",
        company.value,
        venue.value,
        options.serviceSessionId ?? "client",
        created.id,
      ],
    });
    return created;
  }

  async function createLocalIngredient(
    input: CreateLocalIngredientDto,
  ): Promise<ProductCreatedDto> {
    if (!options.serviceSessionId)
      void analytics.track({ eventType: "PRODUCT_CREATE_STARTED", productType: "INGREDIENT" });
    await identity.refreshCsrf();
    const response = await productsControllerCreateIngredient(
      company.value,
      venue.value,
      input,
      {
        credentials: "include",
        headers: { "x-csrf-token": identity.csrfToken.value },
      },
      productApiFetch,
    );
    const created = await requestApi<ProductCreatedDto>(Promise.resolve(response));
    if (!options.serviceSessionId)
      void analytics.track({ eventType: "PRODUCT_CREATE_COMPLETED", productType: "INGREDIENT" });
    return created;
  }

  async function createLocalReferenceValue(
    input: CreateLocalReferenceValueDto,
  ): Promise<ReferenceValueResponseDto> {
    await identity.refreshCsrf();
    const response = await productsControllerCreateReferenceValue(
      company.value,
      venue.value,
      input,
      {
        credentials: "include",
        headers: { "x-csrf-token": identity.csrfToken.value },
      },
      productApiFetch,
    );
    const created = await requestApi<ReferenceValueResponseDto>(Promise.resolve(response));
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: referencesKey.value }),
      ...(input.type === "GARNISH"
        ? [queryClient.invalidateQueries({ queryKey: garnishesKey.value })]
        : []),
    ]);
    return created;
  }

  async function updateCocktail(
    cocktailId: string,
    input: UpdateCocktailDto,
  ): Promise<UpdatedCocktailDto> {
    await identity.refreshCsrf();
    const response = await productsControllerUpdateCocktail(
      company.value,
      venue.value,
      cocktailId,
      input,
      {
        credentials: "include",
        headers: { "x-csrf-token": identity.csrfToken.value },
      },
      productApiFetch,
    );
    const updated = await requestApi<UpdatedCocktailDto>(Promise.resolve(response));
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["cocktail-list", company.value, venue.value],
      }),
      queryClient.invalidateQueries({
        queryKey: [
          "cocktail-card",
          company.value,
          venue.value,
          options.serviceSessionId ?? "client",
          cocktailId,
        ],
      }),
    ]);
    return updated;
  }

  return {
    cocktailQuery,
    createCocktail,
    categoryId,
    createLocalIngredient,
    createLocalReferenceValue,
    garnishesQuery,
    listQuery,
    referencesQuery,
    searchText,
    updateCocktail,
  };
}

function readQuery(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function assignQuery(
  query: Record<string, string | undefined>,
  key: string,
  value: string | null,
): void {
  if (value) query[key] = value;
  else delete query[key];
}
