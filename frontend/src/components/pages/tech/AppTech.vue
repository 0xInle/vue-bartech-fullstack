<template>
  <section class="tech flex">
    <div class="tech__cocktail">
      <h2 class="tech__cocktail-title">{{ title }}</h2>
      <div class="tech__toolbar flex">
        <UiButton
          @click="selectCategory('cocktail')"
          :class="{ 'is-active': currentCategory === 'cocktail' }"
          class="tech__toolbar-btn"
        >
          Коктейли
        </UiButton>
        <UiButton
          @click="selectCategory('customIngredient')"
          :class="{ 'is-active': currentCategory === 'customIngredient' }"
          class="tech__toolbar-btn"
        >
          Ингредиенты
        </UiButton>
        <UiButton
          @click="selectCategory('customGarnish')"
          class="tech__toolbar-btn"
          :class="{ 'is-active': currentCategory === 'customGarnish' }"
        >
          Гарниры
        </UiButton>
      </div>
      <ul class="tech__cocktail-list list-reset">
        <UiLoader v-if="loading" />
        <li class="tech__cocktail-item" v-for="item in visibleItems" :key="item.id">
          <a href="#" class="tech__cocktail-link link-reset" @click="openItemDetails(item)">
            {{ item.name }}
          </a>
        </li>
      </ul>
    </div>
    <div class="tech__actions">
      <ul class="tech__actions-list list-reset flex">
        <li class="tech__actions-item">
          <UiButton
            class="tech__actions-btn"
            :class="{ 'is-active': openModal === 'cocktail' }"
            @click="openForm('cocktail')"
            >Создать коктейль</UiButton
          >
        </li>
        <li class="tech__actions-item">
          <UiButton
            class="tech__actions-btn"
            :class="{ 'is-active': openModal === 'customIngredient' }"
            @click="openForm('customIngredient')"
            >Создать ингредиент</UiButton
          >
        </li>
        <li class="tech__actions-item">
          <UiButton
            class="tech__actions-btn"
            :class="{ 'is-active': openModal === 'customGarnish' }"
            @click="openForm('customGarnish')"
            >Создать гарнир</UiButton
          >
        </li>
      </ul>
      <AppTechCocktailForm
        v-if="openModal === 'cocktail' && !editingCocktail"
        @close="openModal = null"
      />
      <AppTechIngredientForm
        v-if="openModal === 'customIngredient' && !editingIngredient"
        @close="openModal = null"
      />
      <AppTechGarnishForm
        v-if="openModal === 'customGarnish' && !editingGarnish"
        @close="openModal = null"
      />
      <AppTechCocktailEditForm
        v-if="editingCocktail"
        :cocktail="editingCocktail"
        @close="editingCocktail = null"
      />
      <AppTechIngredientEditForm
        :ingredient="editingIngredient"
        v-if="editingIngredient"
        @close="editingIngredient = null"
      />
      <AppTechGarnishEditForm
        :garnish="editingGarnish"
        v-if="editingGarnish"
        @close="editingGarnish = null"
      />
      <UIModal :is-open="showModal" @close="showModal = false">
        <AppTechCocktailDetails
          v-if="selectedCocktail"
          :cocktail="selectedCocktail"
          @edit="editCocktail"
          @close="showModal = false"
        />
        <AppTechIngredientDetails
          v-else-if="selectedIngredient"
          :ingredient="selectedIngredient"
          @edit="editIngredient"
          @close="showModal = false"
        />
        <AppTechGarnishDetails
          v-else-if="selectedGarnish"
          :garnish="selectedGarnish"
          @edit="editGarnish"
          @close="showModal = false"
        />
      </UIModal>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useStore } from '@/stores/store'
import type { Cocktail, CustomGarnish, CustomIngredient } from '@/type/type'
import UiButton from '@/components/Ui/UiButton.vue'
import UiLoader from '@/components/Ui/UiLoader.vue'
import UIModal from '@/components/Ui/UIModal.vue'
import AppTechCocktailForm from './components/AppTechCocktailForm.vue'
import AppTechIngredientForm from './components/AppTechIngredientForm.vue'
import AppTechGarnishForm from './components/AppTechGarnishForm.vue'
import AppTechCocktailDetails from './components/AppTechCocktailDetails.vue'
import AppTechIngredientDetails from './components/AppTechIngredientDetails.vue'
import AppTechGarnishDetails from './components/AppTechGarnishDetails.vue'
import AppTechCocktailEditForm from './components/AppTechCocktailEditForm.vue'
import AppTechIngredientEditForm from './components/AppTechIngredientEditForm.vue'
import AppTechGarnishEditForm from './components/AppTechGarnishEditForm.vue'
import { useEditingItem } from './composables/useEditingItem'

const store = useStore()
const { cocktailsLib, customGarnishLib, customIngredientLib } = storeToRefs(store)

const openModal = ref<'cocktail' | 'customIngredient' | 'customGarnish' | null>(null)
const currentCategory = ref<'cocktail' | 'customIngredient' | 'customGarnish'>('cocktail')
const selectedCocktail = ref<Cocktail | null>(null)
const selectedIngredient = ref<CustomIngredient | null>(null)
const selectedGarnish = ref<CustomGarnish | null>(null)
const loading = ref(false)
const showModal = ref(false)
const {
  editingCocktail,
  editingIngredient,
  editingGarnish,
  editGarnish,
  editIngredient,
  editCocktail,
} = useEditingItem()

const titles = {
  cocktail: 'Коктейли',
  customIngredient: 'Ингредиенты',
  customGarnish: 'Гарниры',
}

const title = computed(() => titles[currentCategory.value] || '')

const itemsByCategory = {
  cocktail: cocktailsLib,
  customIngredient: customIngredientLib,
  customGarnish: customGarnishLib,
}

const visibleItems = computed(() => itemsByCategory[currentCategory.value]?.value ?? [])

function selectCategory(category: typeof currentCategory.value) {
  currentCategory.value = category
  // loadData(category)

  if (openModal.value) {
    openModal.value = category
  }
}

function openForm(type: 'cocktail' | 'customIngredient' | 'customGarnish') {
  openModal.value = type
  currentCategory.value = type
}

function openItemDetails(item: Cocktail | CustomIngredient | CustomGarnish) {
  showModal.value = true

  selectedCocktail.value = null
  selectedIngredient.value = null
  selectedGarnish.value = null

  if (currentCategory.value === 'cocktail') {
    selectedCocktail.value = item as Cocktail
  }

  if (currentCategory.value === 'customIngredient') {
    selectedIngredient.value = item as CustomIngredient
  }

  if (currentCategory.value === 'customGarnish') {
    selectedGarnish.value = item as CustomGarnish
  }
}

// function openCocktailForm() {
//   openModal.value = 'cocktail'
// }

// function openIngredientForm() {
//   openModal.value = 'customIngredient'
// }

// function openGarnishForm() {
//   openModal.value = 'customGarnish'
// }

// function openItemDetails(item: Cocktail | CustomIngredient | CustomGarnish) {
//   if (currentCategory.value === 'cocktail') {
//     selectedItem.value = item
//     showModal.value = true

//     return
//   }

//   if (currentCategory.value === 'customIngredient') {
//     selectedItem.value = item
//     showModal.value = true
//     return
//   }

//   if (currentCategory.value === 'customGarnish') {
//     selectedItem.value = item
//     showModal.value = true

//     return
//   }
// }

// async function fetchCocktails() {
//   const res = await fetch('http://localhost:4000/cocktails')
//   return res.json()
// }

// async function fetchIngredients() {
//   const res = await fetch('http://localhost:4000/ingredients', { cache: 'no-store' })
//   return res.json()
// }

// async function fetchGarnishes() {
//   const res = await fetch('http://localhost:4000/garnishes')
//   return res.json()
// }

// async function loadData(category: typeof currentCategory.value) {
//   loading.value = true

//   const libMap = {
//     cocktail: cocktailsLib,
//     customIngredient: ingredientLib,
//     garnish: garnishLib,
//   }

//   const fetchMap = {
//     cocktail: fetchCocktails,
//     ingredient: fetchIngredients,
//     garnish: fetchGarnishes,
//   }

//   libMap[category].value = await fetchMap[category]()

//   loading.value = false
// }
</script>

<style scoped>
.tech {
  width: 100%;
  gap: 50px;
  align-items: flex-start;
}

.tech__cocktail {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 61px);
  width: 50%;
  padding: 20px;
  border: 1px solid var(--black-color);
  border-radius: 10px;
  background-color: var(--black-color);
  box-shadow: var(--box-shadow);
}

.tech__toolbar {
  gap: 20px;
  margin-bottom: 20px;
}

.tech__cocktail-title {
  display: flex;
  margin: 0;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  max-height: 29.5px;
  font-size: 21px;
  font-weight: 900;
  background-color: var(--white-color);
  border: 1px solid var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
}

.tech__cocktail-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  border: 1px solid var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
  background-color: var(--white-color);
}

.tech__cocktail-item {
  max-width: max-content;
  border-bottom: 1px solid var(--black-color);
}

.tech__cocktail-item:not(:last-child) {
  margin-bottom: 10px;
}

.tech__cocktail-link {
  font-size: 14px;
  font-weight: 500;
}

.tech__actions {
  width: 50%;
}

.tech__actions-list {
  gap: 20px;
  margin-bottom: 20px;
}

.tech__actions-item {
  flex: 1;
}

.tech__actions-btn,
.tech__toolbar-btn {
  width: 100%;
}

.tech__actions-btn.is-active,
.tech__toolbar-btn.is-active {
  background-color: var(--green-dark-color);
  border-color: var(--green-dark-color);
}
</style>
