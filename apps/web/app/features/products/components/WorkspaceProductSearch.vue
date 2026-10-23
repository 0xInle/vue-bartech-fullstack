<template>
  <section v-if="mode === 'home'" class="w-full">
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
      header="Поиск"
      position="right"
      class="!w-full md:!w-[42rem]"
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
    :header="selectedResult?.venueName ?? 'Карточка продукции'"
    position="right"
    class="!w-full md:!w-[42rem]"
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
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Workspace } from "~/types/user-workspaces";
import {
  useWorkspaceProductSearch,
  type WorkspaceSearchItem,
} from "../composables/useWorkspaceProductSearch";
import ProductSearchResultDrawer from "./ProductSearchResultDrawer.vue";
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
watch(
  () => [props.workspace.company.id, props.workspace.venue.id],
  () => {
    selectedResult.value = null;
    resultDrawerVisible.value = false;
  },
);
const isChef = computed(() => props.workspace.role === "chef_bartender");
const isCompanySearch = computed(() => isChef.value && scope.value === "COMPANY");
const isQueryCurrent = computed(() => searchText.value.trim() === debouncedSearch.value);
const page = computed(() => (isQueryCurrent.value ? productQuery.data.value : undefined));
const visibleItems = computed(() => page.value?.items ?? []);
const showLoading = computed(
  () =>
    searchText.value.trim().length >= 2 && (!isQueryCurrent.value || productQuery.isFetching.value),
);

function selectResult(item: WorkspaceSearchItem): void {
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
  drawerVisible.value = false;
  resultDrawerVisible.value = true;
}

function returnToResults(): void {
  resultDrawerVisible.value = false;
  drawerVisible.value = true;
}
</script>
