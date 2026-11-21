<template>
  <section v-if="mode === 'home'" class="flex w-full min-w-0 flex-col">
    <SearchFields v-model:search-text="searchText" v-model:scope="scope" :is-chef="isChef" />
    <SearchResults
      preview-enabled
      :items="visibleItems"
      :loading="showLoading"
      :active="searchText.trim().length >= 2"
      :error="productQuery.isError.value"
      :ready="isQueryCurrent"
      :company-search="isCompanySearch"
      :categories="page?.categories ?? []"
      @select="selectResult"
    />
  </section>

  <template v-else>
    <Button
      label="Поиск"
      icon="pi pi-search"
      severity="secondary"
      variant="outlined"
      size="small"
      @click="drawerVisible = true"
    />
    <Drawer
      v-model:visible="drawerVisible"
      dismissable
      header="Поиск"
      position="right"
      class="drawer-size-lg"
      :pt="{
        root: { class: 'h-full' },
        content: { class: 'h-full' },
        pcCloseButton: { root: { class: '!rounded-md' } },
      }"
    >
      <SearchFields v-model:search-text="searchText" v-model:scope="scope" :is-chef="isChef" />
      <SearchResults
        :items="visibleItems"
        :loading="showLoading"
        :active="searchText.trim().length >= 2"
        :error="productQuery.isError.value"
        :ready="isQueryCurrent"
        :company-search="isCompanySearch"
        :categories="page?.categories ?? []"
        @select="selectResult"
      />
    </Drawer>
  </template>

  <Drawer
    v-model:visible="resultDrawerVisible"
    dismissable
    :header="selectedResult?.venueName ?? 'Карточка продукции'"
    position="right"
    class="drawer-size-lg"
    :pt="{
      root: { class: 'h-full' },
      content: { class: 'h-full' },
      pcCloseButton: { root: { class: '!rounded-md' } },
    }"
  >
    <ProductSearchResultDrawer
      v-if="selectedResult"
      :company-id="workspace.company.id"
      :item="selectedResult"
      @back="returnToResults"
    />
  </Drawer>

  <CocktailCardDrawer
    v-if="previewItem?.type === 'COCKTAIL' && previewItem.venueId === workspace.venue.id"
    :visible="true"
    :cocktail-id="previewItem.id"
    :workspace="workspace"
    @update:visible="closePreview"
    @edit-product="editCocktail"
  />
  <PreparationCardDrawer
    v-if="previewItem?.type === 'PREPARATION' && previewItem.venueId === workspace.venue.id"
    :visible="true"
    :preparation-id="previewItem.id"
    :workspace="workspace"
    @update:visible="closePreview"
    @edit-product="editPreparation"
  />
  <GarnishCardDrawer
    v-if="previewItem?.type === 'GARNISH' && previewItem.venueId === workspace.venue.id"
    :visible="true"
    :garnish-id="previewItem.id"
    :workspace="workspace"
    @update:visible="closePreview"
    @edit-product="editGarnish"
  />

  <CocktailFormDrawer
    v-if="editingProduct?.type === 'COCKTAIL'"
    :visible="true"
    :company-id="workspace.company.id"
    :venue-id="workspace.venue.id"
    :can-manage="canManageProducts"
    mode="edit"
    :cocktail="editingProduct.product"
    @update:visible="closeEditDrawer"
    @updated="refreshSearchResults"
  />
  <PreparationFormDrawer
    v-if="editingProduct?.type === 'PREPARATION'"
    :visible="true"
    :company-id="workspace.company.id"
    :venue-id="workspace.venue.id"
    :can-manage="canManageProducts"
    mode="edit"
    :preparation="editingProduct.product"
    @update:visible="closeEditDrawer"
    @updated="refreshSearchResults"
  />
  <GarnishFormDrawer
    v-if="editingProduct?.type === 'GARNISH'"
    :visible="true"
    :company-id="workspace.company.id"
    :venue-id="workspace.venue.id"
    :can-manage="canManageProducts"
    mode="edit"
    :garnish="editingProduct.product"
    @update:visible="closeEditDrawer"
    @updated="refreshSearchResults"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Workspace } from "~/types/user-workspaces";
import {
  useWorkspaceProductSearch,
  type WorkspaceSearchItem,
} from "../composables/useWorkspaceProductSearch";
import ProductSearchResultDrawer from "./ProductSearchResultDrawer.vue";
import CocktailCardDrawer from "~/features/cocktails/components/CocktailCardDrawer.vue";
import CocktailFormDrawer from "~/features/cocktails/components/CocktailFormDrawer.vue";
import PreparationCardDrawer from "~/features/preparations/components/PreparationCardDrawer.vue";
import PreparationFormDrawer from "~/features/preparations/components/PreparationFormDrawer.vue";
import GarnishCardDrawer from "~/features/garnishes/components/GarnishCardDrawer.vue";
import GarnishFormDrawer from "~/features/garnishes/components/GarnishFormDrawer.vue";
import type { CocktailCardResponseDto } from "~/features/cocktails/composables/useCocktails";
import type { PreparationCardResponseDto } from "~/features/preparations/composables/usePreparations";
import type { GarnishCardResponseDto } from "~/features/garnishes/composables/useGarnishes";
import SearchFields from "./WorkspaceProductSearchFields.vue";
import SearchResults from "./WorkspaceProductSearchResults.vue";

const props = withDefaults(defineProps<{ workspace: Workspace; mode?: "home" | "trigger" }>(), {
  mode: "trigger",
});
const { debouncedSearch, productQuery, scope, searchText } = useWorkspaceProductSearch(
  () => props.workspace,
);
const drawerVisible = ref(false);
const resultDrawerVisible = ref(false);
const selectedResult = ref<WorkspaceSearchItem | null>(null);
const previewItem = ref<WorkspaceSearchItem | null>(null);
const editingProduct = ref<
  | { type: "COCKTAIL"; product: CocktailCardResponseDto }
  | { type: "PREPARATION"; product: PreparationCardResponseDto }
  | { type: "GARNISH"; product: GarnishCardResponseDto }
  | null
>(null);
const returnToSearchDrawer = ref(false);
watch(
  () => [props.workspace.company.id, props.workspace.venue.id],
  () => {
    selectedResult.value = null;
    resultDrawerVisible.value = false;
    previewItem.value = null;
    editingProduct.value = null;
    returnToSearchDrawer.value = false;
  },
);
const isChef = computed(() => props.workspace.role === "chef_bartender");
const canManageProducts = computed(() => props.workspace.permissions.includes("manage_products"));
const isCompanySearch = computed(() => isChef.value && scope.value === "COMPANY");
const isQueryCurrent = computed(() => searchText.value.trim() === debouncedSearch.value);
const page = computed(() => (isQueryCurrent.value ? productQuery.data.value : undefined));
const visibleItems = computed(() => page.value?.items ?? []);
const showLoading = computed(
  () =>
    searchText.value.trim().length >= 2 && (!isQueryCurrent.value || productQuery.isFetching.value),
);

function selectResult(item: WorkspaceSearchItem): void {
  if (
    item.scope === "VENUE" &&
    item.venueId === props.workspace.venue.id &&
    (item.type === "COCKTAIL" || item.type === "PREPARATION" || item.type === "GARNISH")
  ) {
    previewResult(item);
    return;
  }

  if (item.type === "INGREDIENT" || !item.venueId) return;
  if (item.venueId === props.workspace.venue.id) {
    const pathByType: Record<string, string> = {
      COCKTAIL: "cocktails",
      PREPARATION: "preparations",
      GARNISH: "garnishes",
    };
    const section = pathByType[item.type];
    if (!section) return;
    void navigateTo(
      `/app/companies/${props.workspace.company.id}/venues/${props.workspace.venue.id}/${section}/${item.id}`,
    );
    drawerVisible.value = false;
    return;
  }
  if (!isCompanySearch.value) return;
  selectedResult.value = item;
  returnToSearchDrawer.value = props.mode === "trigger";
  drawerVisible.value = false;
  resultDrawerVisible.value = true;
}

function previewResult(item: WorkspaceSearchItem): void {
  if (
    item.scope !== "VENUE" ||
    (item.type !== "COCKTAIL" && item.type !== "PREPARATION" && item.type !== "GARNISH")
  )
    return;

  if (item.venueId === props.workspace.venue.id) {
    previewItem.value = item;
    return;
  }
  if (!isCompanySearch.value || !item.venueId) return;
  selectedResult.value = item;
  returnToSearchDrawer.value = false;
  resultDrawerVisible.value = true;
}

function closePreview(): void {
  previewItem.value = null;
}

function editCocktail(product: CocktailCardResponseDto): void {
  if (!canManageProducts.value) return;
  previewItem.value = null;
  editingProduct.value = { type: "COCKTAIL", product };
}

function editPreparation(product: PreparationCardResponseDto): void {
  if (!canManageProducts.value) return;
  previewItem.value = null;
  editingProduct.value = { type: "PREPARATION", product };
}

function editGarnish(product: GarnishCardResponseDto): void {
  if (!canManageProducts.value) return;
  previewItem.value = null;
  editingProduct.value = { type: "GARNISH", product };
}

function closeEditDrawer(visible: boolean): void {
  if (!visible) editingProduct.value = null;
}

function refreshSearchResults(): void {
  void productQuery.refetch();
}

function returnToResults(): void {
  resultDrawerVisible.value = false;
  if (returnToSearchDrawer.value) drawerVisible.value = true;
  returnToSearchDrawer.value = false;
}
</script>
