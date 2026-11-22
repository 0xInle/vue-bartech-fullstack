<template>
  <FloatLabel variant="on">
    <IconField class="w-full">
      <InputIcon class="pi pi-search" />
      <AutoComplete
        input-id="product-search"
        :model-value="searchText"
        :suggestions="noSuggestions"
        size="small"
        show-clear
        :show-empty-message="false"
        :force-selection="false"
        class="w-full"
        aria-label="Поиск продукции"
        fluid
        :pt="{ pcInputText: { root: { maxlength: 160 } } }"
        @update:model-value="emit('update:searchText', String($event ?? ''))"
        @focus="emit('focus')"
      />
    </IconField>
    <label for="product-search" class="text-xs">Поиск</label>
  </FloatLabel>
</template>

<script setup lang="ts">
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
const noSuggestions: string[] = [];
defineProps<{ searchText: string }>();
const emit = defineEmits<{
  "update:searchText": [value: string];
  focus: [];
}>();
</script>
