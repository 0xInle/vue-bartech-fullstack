<template>
  <div v-if="canManageArchive || canDeletePermanently" class="flex items-center gap-1" @click.stop>
    <ArchiveRestoreDialog
      v-if="canManageArchive"
      :company-id="companyId"
      :venue-id="venueId"
      :product-id="product.id"
      :product-type="product.type"
      stay-on-page
      @restored="emit('restored', $event)"
    >
      <template #trigger="{ open, loading }">
        <Button
          v-tooltip.top="{ value: 'Восстановить', class: 'app-tooltip' }"
          icon="pi pi-refresh"
          size="small"
          severity="primary"
          variant="text"
          :loading="loading"
          :disabled="loading"
          :aria-label="`Восстановить ${product.name}`"
          @click.stop="open"
        />
      </template>
    </ArchiveRestoreDialog>
    <PermanentDeleteActionButton
      v-if="canDeletePermanently"
      :company-id="companyId"
      :venue-id="venueId"
      :product-id="product.id"
      :product-name="product.name"
      :product-type="product.type"
      :can-manage="canDeletePermanently"
      @deleted="emit('deleted', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ArchiveItem } from "../composables/useProductArchive";
import ArchiveRestoreDialog from "./ArchiveRestoreDialog.vue";
import PermanentDeleteActionButton from "./PermanentDeleteActionButton.vue";

defineProps<{
  companyId: string;
  venueId: string;
  product: ArchiveItem;
  canManageArchive: boolean;
  canDeletePermanently: boolean;
}>();
const emit = defineEmits<{
  restored: [productId: string];
  deleted: [productId: string];
}>();
</script>
