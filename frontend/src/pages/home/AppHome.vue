<template>
  <section class="home flex">
    <UiInput
      v-model="input"
      placeholder="Введите данные для поиска"
      type="text"
      class="home-input"
    />
    <div class="home-btn-container grid">
      <UiButton class="nome-btn">Гарниры</UiButton>
      <UiButton class="nome-btn">Меню</UiButton>
      <UiButton class="nome-btn">Полуфабрикаты</UiButton>
      <UiButton class="nome-btn">Графики</UiButton>
      <UiButton class="nome-btn">Документы</UiButton>
      <UiButton class="nome-btn">Заказы</UiButton>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import UiButton from '@/components/Ui/UiButton.vue'
import UiInput from '@/components/Ui/UiInput.vue'

const input = ref('')

watch(input, (val) => {
  console.log(val)
})
</script>

<style scoped>
.home {
  flex-direction: column;
  align-items: center;
  justify-content: space-evenly;
}

.home-input {
  color: var(--black-color);
}

.home-btn-container {
  grid-template-columns: repeat(3, 1fr);
  row-gap: 30px;
  column-gap: 60px;
  justify-items: center;
}

.nome-btn {
  width: 200px;
  height: 100px;
  font-weight: 900;
}
</style>
