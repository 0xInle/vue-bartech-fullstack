<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal" @click.self="emit('close')">
      <div :class="['modal__content', size]" @click.stop>
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useEventListener } from '@vueuse/core'

const props = defineProps<{ isOpen: boolean; size?: 'sm' | 'md' | 'lg' }>()
const emit = defineEmits(['close', 'update:isOpen'])

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.isOpen) {
    emit('close')
  }
})
</script>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal__content {
  background: var(--black-color);
  border-radius: 10px;
  padding: 20px;
  width: 25%;
  overflow-y: auto;
  box-shadow: var(--box-shadow);
}

.modal__content.md {
  width: 50%;
}
</style>
