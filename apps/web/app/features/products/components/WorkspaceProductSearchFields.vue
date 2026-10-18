<template>
  <div class="space-y-3">
    <InputText
      :model-value="searchText"
      :maxlength="160"
      size="small"
      class="w-full"
      placeholder="Название, ингредиент или часть состава"
      aria-label="Поиск продукции"
      @update:model-value="emit('update:searchText', String($event ?? ''))"
    />
    <div v-if="isChef" class="flex items-center gap-2">
      <label class="flex items-center gap-2 text-sm text-color-secondary">
        <Checkbox
          :model-value="scope === 'COMPANY'"
          binary
          input-id="company-product-search"
          @update:model-value="emit('update:scope', $event ? 'COMPANY' : 'VENUE')"
        />
        <span>Все заведения компании</span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { WorkspaceSearchScope } from "../composables/useWorkspaceProductSearch";

defineProps<{
  searchText: string;
  scope: WorkspaceSearchScope;
  isChef: boolean;
}>();
const emit = defineEmits<{
  "update:searchText": [value: string];
  "update:scope": [value: WorkspaceSearchScope];
}>();
</script>
