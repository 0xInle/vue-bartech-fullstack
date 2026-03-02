<template>
  <div class="select" ref="target">
    <UiButton class="select__toggle btn-reset" @click="isDropdownOpen = !isDropdownOpen">
      {{ selectedValue || placeholder }}
    </UiButton>
    <ul class="select__list list-reset" v-if="isDropdownOpen">
      <li class="select__item" v-for="(item, index) in options" :key="item + index">
        <UiButton class="select__button" @click="selectOption(item)">
          {{ item }}
        </UiButton>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, useTemplateRef, watch } from 'vue'
import UiButton from './UiButton.vue'
import { onClickOutside } from '@vueuse/core'

interface SelectProps<T extends string> {
  modelValue: T
  options: readonly T[]
  placeholder: string
}

const props = defineProps<SelectProps<string>>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const target = useTemplateRef('target')
const isDropdownOpen = ref(false)
const selectedValue = ref<string>(props.modelValue)

watch(
  () => props.modelValue,
  (newVal) => {
    selectedValue.value = newVal ?? ''
  },
  { immediate: true },
)

function selectOption(item: string) {
  selectedValue.value = item
  emit('update:modelValue', item)
  isDropdownOpen.value = false
}

onClickOutside(target, () => {
  isDropdownOpen.value = false
})
</script>

<style scoped>
.select {
  align-items: center;
  position: relative;
  flex-shrink: 0;
  font-size: 12px;
}

.select__toggle {
  width: 100%;
  height: 29.5px;
  padding: 5px;
  color: var(--black-color);
  min-width: 35px;
  font-size: 12px;

  /* border: 1px solid var(--black-color); */
  box-shadow: var(--box-shadow);
  border-radius: 5px;
  transition: all 0.3s ease-in-out;

  /* &:hover {
    background-color: rgba(0, 0, 0, 0.2);
  } */
}

.select__list {
  display: flex;
  flex-direction: column;
  padding: 5px;
  border: 1px solid var(--black-color);
  position: absolute;
  gap: 5px;
  top: 120%;
  right: -1px;
  border-radius: 5px;
  background-color: var(--white-color);
  box-shadow: var(--box-shadow);
  z-index: 10;
}

.select__item {
  width: 100%;
}

.select__button {
  display: flex;
  justify-content: end;
  align-items: center;
  width: 100%;
  height: 29.5px;
  padding: 5px;
  color: var(--black-color);
  white-space: nowrap;
  min-width: 100px;
  font-size: 12px;
  box-shadow: var(--box-shadow);
  border-radius: 5px;
  transition: all 0.3s ease-in-out;
}
</style>
