<template>
  <Dialog
    :visible="visible"
    modal
    :draggable="false"
    :close-button-props="{ severity: 'secondary', text: true, rounded: true }"
    :header="checklist?.title ?? 'Чек-лист'"
    class="dialog-size-md"
    :pt="{ pcCloseButton: { root: { class: '!rounded-md' } } }"
    @update:visible="emit('update:visible', $event)"
  >
    <ol v-if="checklist" class="max-h-[60vh] list-decimal space-y-2 overflow-y-auto pl-5 text-sm">
      <li v-for="(step, index) in checklist.steps" :key="`${index}-${step}`" class="break-words">
        {{ step }}
      </li>
    </ol>
    <template #footer>
      <Button label="Закрыть" size="small" @click="emit('update:visible', false)" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import type { VenueChecklistDto } from "@bartech/api-client";

defineProps<{ visible: boolean; checklist: VenueChecklistDto | null }>();
const emit = defineEmits<{ "update:visible": [visible: boolean] }>();
</script>
