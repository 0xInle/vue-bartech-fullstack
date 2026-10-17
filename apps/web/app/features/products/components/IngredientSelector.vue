<template>
  <div class="flex flex-col gap-2">
    <AutoComplete
      v-model="selectedProduct"
      :suggestions="suggestions"
      option-label="name"
      size="small"
      :delay="250"
      :loading="isSearching"
      :min-length="2"
      fluid
      :placeholder="placeholder"
      @complete="search"
    >
      <template #option="slotProps">
        <div class="flex flex-col gap-1 py-1">
          <span>{{ slotProps.option.name }}</span>
          <span class="text-xs text-color-secondary">
            {{ slotProps.option.scope === "GLOBAL" ? "Каталог IndieBar" : "Это заведение" }}
          </span>
        </div>
      </template>
    </AutoComplete>
    <Message v-if="hasSearchError" severity="error" size="small" variant="simple">
      Не удалось выполнить поиск. Попробуйте ещё раз.
    </Message>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useProductSearch } from "../composables/useProductSearch";
import type { ProductSearchItem } from "../types";

const props = defineProps<{
  companyId: string;
  venueId: string;
  serviceSessionId?: string;
  placeholder?: string;
}>();

const selectedProduct = defineModel<ProductSearchItem | null>({ default: null });
const { searchText, searchQuery } = useProductSearch(
  () => props.companyId,
  () => props.venueId,
  { serviceSessionId: props.serviceSessionId },
);
const suggestions = computed(() => searchQuery.data.value ?? []);
const isSearching = computed(() => searchQuery.isFetching.value);
const hasSearchError = computed(() => searchQuery.isError.value);

function search(event: { query: string }): void {
  searchText.value = event.query;
}
</script>
