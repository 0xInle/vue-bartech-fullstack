<template>
  <div class="documents__nav">
    <ul class="documents__list list-reset flex">
      <li class="documents__item">
        <button
          class="documents__button btn-reset"
          :class="{ 'is-active': currencyCategory === 'checklists' }"
          @click="openComponent('checklists')"
        >
          Чеклисты
        </button>
      </li>
      <li class="documents__item">
        <button
          class="documents__button btn-reset"
          :class="{ 'is-active': currencyCategory === 'requests' }"
          @click="openComponent('requests')"
        >
          Заявки
        </button>
      </li>
      <li class="documents__item">
        <button
          class="documents__button btn-reset"
          :class="{ 'is-active': currencyCategory === 'techcards' }"
          @click="openComponent('techcards')"
        >
          Технологические карты
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const currencyCategory = ref('')
const emit = defineEmits<{
  (e: 'openComponent', tab: string): void
}>()

function openComponent(tab: string) {
  currencyCategory.value = tab
  emit('openComponent', tab)
}
</script>

<style scoped>
.documents__nav {
  max-width: max-content;
  margin: 0 auto;
  margin-bottom: 20px;
}

.documents__list {
  align-items: center;
  gap: 20px;
  padding: 7px 20px;
  background-color: var(--black-color);
  border: 1px solid var(--black-color);
  box-shadow: var(--box-shadow);
  border-radius: 10px;
}

.documents__button {
  outline: none;
  position: relative;
  font-size: 14px;
  color: var(--white-color);
  font-weight: 700;
  transition: all 0.3s ease-in-out;

  &:hover {
    color: var(--green-bright-color);
  }

  &:focus {
    color: var(--green-bright-color);
  }

  &:active {
    color: var(--green-bright-color);
  }

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 1px;
    background-color: var(--green-bright-color);
    transition: all 0.3s ease-in-out;
  }

  &:hover::after {
    width: 100%;
  }
}

.is-active.documents__button {
  color: var(--green-bright-color);

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    height: 1px;
    background-color: var(--green-bright-color);
    transition: all 0.3s ease-in-out;
  }
}
</style>
