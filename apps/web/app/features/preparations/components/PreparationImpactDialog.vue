<template>
  <Dialog
    :visible="visible"
    modal
    header="Изменение затронет другие карточки"
    class="w-[calc(100vw-2rem)] max-w-xl"
    @update:visible="emit('cancel')"
  >
    <p class="text-sm text-color-secondary">
      Сохранение изменит заготовку, которая используется в других активных продуктах:
      {{ products.length }}.
    </p>
    <ul class="mt-4 max-h-72 space-y-2 overflow-y-auto text-sm">
      <li v-for="product in products" :key="product.id" class="flex gap-2">
        <span class="min-w-24 text-color-secondary">{{ typeLabel(product.type) }}</span>
        <span>{{ product.name }}</span>
      </li>
    </ul>
    <template #footer>
      <Button
        label="Отмена"
        severity="secondary"
        variant="text"
        size="small"
        @click="emit('cancel')"
      />
      <Button label="Сохранить изменения" size="small" :loading="saving" @click="emit('confirm')" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import type { PreparationImpact } from "../composables/usePreparations";

defineProps<{
  visible: boolean;
  products: PreparationImpact["affectedProducts"];
  saving: boolean;
}>();
const emit = defineEmits<{ cancel: []; confirm: [] }>();

function typeLabel(type: string): string {
  switch (type) {
    case "PREPARATION":
      return "Заготовка";
    case "GARNISH":
      return "Гарнир";
    default:
      return "Коктейль";
  }
}
</script>
