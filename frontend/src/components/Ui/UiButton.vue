<template>
  <button :type="type" @click="handleClick" class="btn-reset">
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: 'button' | 'submit' | 'reset' | undefined
  }>(),
  {
    type: 'button',
  },
)

const emit = defineEmits<{
  (event: 'click'): void
}>()

function handleClick() {
  emit('click')
}
</script>

<style scoped>
button {
  outline: none;
  padding: 6px;
  color: var(--black-color);
  font-weight: 700;
  background-color: var(--green-bright-color);
  border: 1px solid var(--green-bright-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
  transition: all 0.3s ease-in-out;

  &:hover {
    background-color: var(--green-dark-color);
    border: 1px solid var(--green-dark-color);
  }

  &:focus-visible {
    background-color: var(--green-dark-color);
    border: 1px solid var(--green-dark-color);
  }

  &:active {
    border: 1px solid var(--green-dark-color);
  }
}
</style>
