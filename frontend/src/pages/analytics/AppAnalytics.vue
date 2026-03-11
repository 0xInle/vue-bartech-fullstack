<template>
  <section class="analystics">
    Аналитика
    <input type="text" placeholder="Введите ингредиент" v-model="ingredient" />
    <button @click="createIngredient(ingredient)">Сохранить в БД</button>
  </section>
</template>

<script setup lang="ts">
import axios from 'axios'
import { ref } from 'vue'
const ingredient = ref('')

async function createIngredient(name: string) {
  const response = await axios.post('http://localhost:4000/ingredients', { name })
  console.log(response.data)
  return response.data
}
</script>
