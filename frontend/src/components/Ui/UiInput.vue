<template>
  <input
    :class="customClass"
    :type="type"
    :placeholder="placeholder"
    :value="modelValue"
    @input="onInput"
  />
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string | number | null
  type: string
  placeholder: string
  customClass?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<style scoped>
input {
  width: 100%;
  padding: 10px 20px;
  color: var(--black-color);
  font-size: 14px;
  border: 1px solid var(--black-color);
  box-shadow: var(--box-shadow);
  border-radius: 10px;
  outline: none;
  transition: all 0.3s ease-in-out;

  &:focus {
    border-color: var(--green-bright-color);
    box-shadow: 0 0 10px rgba(134, 194, 50, 0.3);
  }
}
</style>
