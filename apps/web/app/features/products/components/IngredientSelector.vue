<template>
  <div class="flex flex-col gap-2">
    <FloatLabel v-if="floatLabel" variant="on">
      <AutoComplete
        ref="autoComplete"
        v-model="selectedProduct"
        :input-id="inputId"
        :suggestions="suggestions"
        option-label="name"
        size="small"
        :invalid="invalid"
        :delay="250"
        :loading="isSearching"
        :min-length="2"
        :append-to="keepOverlayOpenOnScroll ? 'self' : undefined"
        fluid
        :pt="{ overlay: { class: 'w-max min-w-full' }, emptyMessage: { class: '!hidden' } }"
        @complete="search"
        @show="handleShow"
        @hide="handleHide"
      >
        <template #option="slotProps">
          <div class="whitespace-nowrap py-1">{{ slotProps.option.name }}</div>
        </template>
        <template #empty><span class="hidden" /></template>
        <template #footer>
          <slot
            name="footer"
            :query="searchText"
            :loading="isSearching"
            :has-results="suggestions.length > 0"
            :has-error="hasSearchError"
            :has-loaded="searchQuery.isSuccess.value"
            :has-exact-ingredient="hasExactIngredient"
          />
        </template>
      </AutoComplete>
      <label :for="inputId" class="text-xs">{{ label }}</label>
    </FloatLabel>
    <AutoComplete
      v-else
      ref="autoComplete"
      v-model="selectedProduct"
      :suggestions="suggestions"
      option-label="name"
      size="small"
      :invalid="invalid"
      :delay="250"
      :loading="isSearching"
      :min-length="2"
      :append-to="keepOverlayOpenOnScroll ? 'self' : undefined"
      fluid
      :placeholder="placeholder"
      :pt="{ overlay: { class: 'w-max min-w-full' }, emptyMessage: { class: '!hidden' } }"
      @complete="search"
      @show="handleShow"
      @hide="handleHide"
    >
      <template #option="slotProps">
        <div class="whitespace-nowrap py-1">{{ slotProps.option.name }}</div>
      </template>
      <template #empty><span class="hidden" /></template>
      <template #footer>
        <slot
          name="footer"
          :query="searchText"
          :loading="isSearching"
          :has-results="suggestions.length > 0"
          :has-error="hasSearchError"
          :has-loaded="searchQuery.isSuccess.value"
          :has-exact-ingredient="hasExactIngredient"
        />
      </template>
    </AutoComplete>
    <Message v-if="hasSearchError" severity="error" :closable="false" :pt="compactMessagePt">
      Не удалось выполнить поиск. Попробуйте ещё раз.
    </Message>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useProductSearch } from "../composables/useProductSearch";
import type { ProductSearchItem } from "../types";
import { compactMessagePt } from "~/utils/primevue-message";
import {
  keepPrimeVueOverlayOpenOnScroll,
  keepPrimeVueOverlayWithinDrawer,
  type PrimeVueOverlayRef,
} from "~/utils/primevue-overlay";

const props = defineProps<{
  companyId: string;
  venueId: string;
  serviceSessionId?: string;
  placeholder?: string;
  floatLabel?: boolean;
  inputId?: string;
  label?: string;
  invalid?: boolean;
  keepOverlayOpenOnScroll?: boolean;
}>();

const selectedProduct = defineModel<ProductSearchItem | null>({ default: null });
const emit = defineEmits<{ hide: [] }>();
const autoComplete = ref<PrimeVueOverlayRef | null>(null);
const { searchText, searchQuery } = useProductSearch(
  () => props.companyId,
  () => props.venueId,
  { serviceSessionId: props.serviceSessionId },
);
const suggestions = computed(() => searchQuery.data.value ?? []);
const isSearching = computed(() => searchQuery.isFetching.value);
const hasSearchError = computed(() => searchQuery.isError.value);
const hasExactIngredient = computed(() => {
  const query = normalizeProductName(searchText.value);
  return (
    query.length > 0 &&
    suggestions.value.some(
      (product) => product.type === "INGREDIENT" && normalizeProductName(product.name) === query,
    )
  );
});

function normalizeProductName(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

function search(event: { query: string }): void {
  searchText.value = event.query;
}

function handleHide(): void {
  emit("hide");
}

function handleShow(): void {
  if (props.keepOverlayOpenOnScroll) {
    keepPrimeVueOverlayOpenOnScroll(autoComplete.value);
    keepPrimeVueOverlayWithinDrawer(autoComplete.value);
  }
}

function hideSuggestions(): void {
  autoComplete.value?.hide();
}

defineExpose({ hideSuggestions });
</script>
