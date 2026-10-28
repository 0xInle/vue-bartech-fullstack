<template>
  <div>
    <LoadingIndicator v-if="loading" screen />
    <Message v-else-if="active && error" severity="error" :closable="false" :pt="compactMessagePt">
      Не удалось выполнить поиск. Попробуйте ещё раз.
    </Message>
    <Message
      v-else-if="active && ready && items.length === 0"
      severity="secondary"
      :closable="false"
      :pt="compactMessagePt"
      class="mt-2"
    >
      По вашему запросу ничего не найдено
    </Message>
    <DataTable
      v-else-if="active && ready && items.length > 0"
      v-model:selection="selectedItem"
      :value="items"
      data-key="id"
      selection-mode="single"
      :meta-key-selection="false"
      size="small"
      row-hover
      class="product-search-results-table mt-3 text-sm"
      :pt="productSearchTablePt"
      @row-select="emit('select', $event.data)"
    >
      <Column field="name" header="Наименование">
        <template #body="{ data }">
          <span class="font-medium">{{ data.name }}</span>
          <span v-if="companySearch && data.venueName" class="block text-xs text-color-secondary">
            {{ data.venueName }}
          </span>
        </template>
      </Column>
      <Column field="type" header="Категория" style="width: 1%; white-space: nowrap">
        <template #body="{ data }">{{ categoryLabel(data) }}</template>
      </Column>
    </DataTable>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import type { ProductSearchCategoryResponseDto } from "@bartech/api-client";
import { compactMessagePt } from "~/utils/primevue-message";
import type { WorkspaceSearchItem } from "../composables/useWorkspaceProductSearch";

const props = defineProps<{
  items: WorkspaceSearchItem[];
  loading: boolean;
  active: boolean;
  error: boolean;
  ready: boolean;
  companySearch: boolean;
  categories: ProductSearchCategoryResponseDto[];
}>();
const emit = defineEmits<{
  select: [item: WorkspaceSearchItem];
}>();
const selectedItem = ref<WorkspaceSearchItem | null>(null);
const productSearchTablePt = {
  root: {
    style: {
      "--p-datatable-border-color": "var(--p-content-border-color)",
      "--p-datatable-header-cell-background": "transparent",
      "--p-datatable-row-background": "transparent",
      "--p-datatable-row-hover-background":
        "color-mix(in srgb, var(--p-primary-100) 70%, var(--p-content-background))",
      border: "1px solid var(--p-datatable-border-color)",
      borderRadius: "var(--p-content-border-radius)",
    },
  },
  headerCell: {
    class: "whitespace-nowrap px-1 py-1 text-sm",
    style: {
      borderTop: "0",
      borderRight: "0",
      borderLeft: "0",
      borderBottom: "1px solid var(--p-content-border-color)",
      fontWeight: "400",
    },
  },
  bodyCell: {
    class: "px-1 py-1 text-sm",
    style: {
      borderTop: "0",
      borderRight: "0",
      borderLeft: "0",
      borderBottom: "1px solid var(--p-content-border-color)",
    },
  },
  bodyRow: { class: "cursor-pointer" },
};

watch(
  () => props.items,
  () => (selectedItem.value = null),
);

function categoryLabel(item: WorkspaceSearchItem): string {
  if (item.type === "INGREDIENT") {
    return (
      props.categories.find(
        (category) => category.type === "INGREDIENT" && category.code === item.categoryCode,
      )?.name ?? "Без категории"
    );
  }

  const labels: Record<string, string> = {
    PREPARATION: "Заготовка",
    GARNISH: "Гарнир",
    COCKTAIL: "Коктейль",
  };
  return labels[item.type] ?? "Продукция";
}
</script>

<style scoped>
:deep(.product-search-results-table .p-datatable-tbody > tr:last-child > td) {
  border-block-end-width: 0;
}
</style>
