<template>
  <UiDecorationBlock v-if="visible">
    <div class="error">{{ text }}</div>
  </UiDecorationBlock>
</template>

<script setup lang="ts">
import UiDecorationBlock from '@/components/Ui/UiDecorationBlock.vue'

import { ref, watch } from 'vue'

const props = defineProps<{
  text: string
}>()

const visible = ref(false)
let timeout: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.text,
  (newVal) => {
    if (newVal) {
      visible.value = true

      if (timeout) {
        clearTimeout(timeout)
      }

      timeout = setTimeout(() => {
        visible.value = false
      }, 3000)
    }
  },
)
</script>

<style scoped>
.error {
  padding: 0 20px;
  color: var(--red-color);
  border-radius: 5px;
  font-size: 14px;
}
</style>
