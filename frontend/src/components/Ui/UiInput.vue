<template>
  <input v-model="model" :type="type" :placeholder="placeholder" />
</template>

<script setup lang="ts">
const model = defineModel<string | number | null>()

defineProps<{
  type: string
  placeholder: string
}>()
</script>

<style scoped>
input {
  width: 100%;
  padding: 10px 20px;
  border: 1px solid var(--black-color);
  color: var(--black-color);
  max-height: 28px;
  font-size: 14px;
  box-shadow: var(--box-shadow);
  border-radius: 5px;
  outline: none;
  transition: all 0.3s ease-in-out;

  &:focus {
    border-color: var(--green-bright-color);
    box-shadow: 0 0 10px rgb(134 194 50 / 30%);
  }
}
</style>
