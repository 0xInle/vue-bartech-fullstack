<template>
  <section class="about flex">
    О проекте
    <div>
      <input v-model="query" @input="searchIngredients" placeholder="Поиск ингредиента" />
      <ul>
        <li v-for="item in results" :key="item.id">
          {{ item.name }}
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import axios from 'axios'
import type { Ingredient } from '@/type/type'

const query = ref('')
const results = ref<Ingredient[]>([])

async function searchIngredients() {
  const res = await axios.get('http://localhost:4000/ingredients', {
    params: { search: query.value },
  })
  results.value = res.data
}
</script>
