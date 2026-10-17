<template>
  <Dialog
    :visible="visible"
    modal
    :closable="!saving"
    :dismissable-mask="!saving"
    header="Подтвердите изменение гарнира"
    class="w-[calc(100vw-2rem)] max-w-xl"
    @update:visible="(next) => !next && emit('cancel')"
  >
    <p class="text-sm text-color-secondary">
      Гарнир используется в {{ products.length }} активных коктейлях. Подтвердите изменение
      техкарты.
    </p>
    <ul class="mt-4 max-h-64 divide-y divide-surface overflow-auto">
      <li v-for="product in products" :key="product.id" class="py-2 text-sm">
        {{ product.name }}
      </li>
    </ul>
    <template #footer>
      <Button
        label="Отмена"
        severity="secondary"
        variant="text"
        :disabled="saving"
        @click="emit('cancel')"
      />
      <Button label="Подтвердить" :loading="saving" @click="emit('confirm')" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import type { GarnishImpact } from "../composables/useGarnishes";

defineProps<{ visible: boolean; products: GarnishImpact["affectedProducts"]; saving: boolean }>();
const emit = defineEmits<{ cancel: []; confirm: [] }>();
</script>
