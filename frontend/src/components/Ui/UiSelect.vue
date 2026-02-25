<template>
  <div class="select" ref="target">
    <UiButton class="select__toggle btn-reset" @click="show = !show">
      {{ selectedValue || placeholder }}
    </UiButton>
    <ul class="select__list list-reset" v-if="show">
      <li class="select__item" v-for="(item, index) in selectArr" :key="item + index">
        <UiButton class="select__button" @click="selectedItem(item)">
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
  selectArr: readonly T[]
  placeholder: string
}

const props = defineProps<SelectProps<string>>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const target = useTemplateRef('target')
const show = ref(false)
const selectedValue = ref<string>(props.modelValue)

watch(
  () => props.modelValue,
  (newVal) => {
    selectedValue.value = newVal ?? ''
  },
  { immediate: true },
)

function selectedItem(item: string) {
  selectedValue.value = item
  emit('update:modelValue', item)
  show.value = false
}

onClickOutside(target, () => {
  show.value = false
})
</script>

<style scoped>
.select {
  position: relative;
  align-items: center;
  flex-shrink: 0;
  font-size: 12px;
}

.select__toggle {
  width: 100%;
  min-width: 35px;
  padding: 5px;
  height: 29.5px;
  font-size: 12px;
  color: var(--black-color);
  /* border: 1px solid var(--black-color); */
  box-shadow: var(--box-shadow);
  border-radius: 5px;
  transition: all 0.3s ease-in-out;

  /* &:hover {
    background-color: rgba(0, 0, 0, 0.2);
  } */
}

.select__list {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 5px;
  top: 120%;
  right: -1px;
  padding: 5px;
  border: 1px solid var(--black-color);
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
  align-items: center;
  justify-content: end;
  white-space: nowrap;
  width: 100%;
  min-width: 100px;
  height: 29.5px;
  padding: 5px;
  font-size: 12px;
  color: var(--black-color);
  box-shadow: var(--box-shadow);
  border-radius: 5px;
  transition: all 0.3s ease-in-out;
}
</style>
