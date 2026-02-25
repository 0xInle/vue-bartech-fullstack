<template>
  <div class="cocktail-form" ref="target">
    <form class="cocktail-form__content flex" @submit.prevent="createCoctail">
      <div class="cocktail-form__section flex">
        <label class="cocktail-form__label"> Название: </label>
        <UiInput
          v-model="coctail.name"
          type="text"
          class="cocktail-form__input"
          placeholder="Название коктейля"
        />
      </div>
      <div class="cocktail-form__section flex">
        <label class="cocktail-form__label"> Ингридиенты: </label>
        <div
          class="cocktail-form__row flex"
          v-for="ingredient in coctail.ingredients"
          :key="ingredient.id"
        >
          <UiInput
            v-model="ingredient.name"
            type="text"
            class="cocktail-form__input cocktail-form__input--ingredients"
            placeholder="Название ингридиента"
          />
          <UiInput
            v-model.number="ingredient.amount"
            type="text"
            class="cocktail-form__input cocktail-form__input--unit"
            placeholder="Объем"
          />
          <UiSelect v-model="ingredient.unit" :placeholder="UNITS[0]" :selectArr="UNITS" />
          <UiButton
            :disabled="coctail.ingredients.length === 1"
            @click="delIngredient(ingredient.id)"
            class="cocktail-form__button cocktail-form__button--delete"
          >
            x
          </UiButton>
        </div>
      </div>
      <UiButton
        class="cocktail-form__button btn-reset"
        @click="addIngredient"
        v-if="coctail.ingredients.length < 20"
        >Добавить ингридиент</UiButton
      >
      <div class="cocktail-form__section flex">
        <label class="cocktail-form__label"> Описание: </label>
        <div class="cocktail-form__row flex">
          <UiSelect
            v-model="coctail.params.glass"
            :selectArr="GLASS"
            placeholder="Бокал"
            class="cocktail-form__param cocktail-form__param--glases"
          />
          <UiSelect
            v-model="coctail.params.ice"
            :selectArr="ICE"
            placeholder="Лед"
            class="cocktail-form__param cocktail-form__param--ice"
          />
          <UiSelect
            v-model="coctail.params.method"
            :selectArr="METHOD"
            placeholder="Метод"
            class="cocktail-form__param cocktail-form__param--method"
          />
        </div>
      </div>
      <div class="cocktail-form__section flex">
        <label class="cocktail-form__label"> Гарнир: </label>
        <UiInput
          type="text"
          placeholder="Название гарнира"
          v-model="coctail.garnish"
          class="cocktail-form__input"
        />
      </div>
      <div class="cocktail-form__section flex">
        <label class="cocktail-form__label"> Комментарий: </label>
        <textarea v-model="coctail.comment" class="cocktail-form__comment" rows="5"> </textarea>
      </div>
      <UiButton type="submit" class="cocktail-form__button btn-reset"> Создать коктейль </UiButton>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { Coctail } from '@/type/type'
import { useStore } from '@/stores/store'
import { reactive, useTemplateRef } from 'vue'
import UiInput from '@/components/Ui/UiInput.vue'
import UiButton from '@/components/Ui/UiButton.vue'
import UiSelect from '@/components/Ui/UiSelect.vue'
import { UNITS, GLASS, ICE, METHOD } from '@/type/consts'
import { onClickOutside } from '@vueuse/core'
import { v4 as uuidv4 } from 'uuid'

const target = useTemplateRef('target')
const emit = defineEmits(['close'])

onClickOutside(target, () => {
  emit('close')
})

const store = useStore()

const coctail = reactive<Coctail>({
  id: '',
  name: '',
  ingredients: [
    {
      id: '',
      name: '',
      amount: null,
      unit: UNITS[0],
    },
  ],
  params: {
    glass: '',
    ice: '',
    method: '',
  },
  comment: '',
  garnish: '',
})

function addIngredient() {
  coctail.ingredients.push({
    id: uuidv4(),
    name: '',
    amount: null,
    unit: UNITS[0],
  })
}

function delIngredient(id: string) {
  if (coctail.ingredients.length > 1) {
    coctail.ingredients = coctail.ingredients.filter((i) => i.id !== id)
  }
}

function createCoctail() {
  const newCocktail: Coctail = {
    id: uuidv4(),
    name: coctail.name.trim(),
    ingredients: coctail.ingredients.map((i) => ({
      id: uuidv4(),
      name: i.name.trim(),
      amount: i.amount,
      unit: i.unit || UNITS[0],
    })),
    params: {
      glass: coctail.params.glass,
      ice: coctail.params.ice,
      method: coctail.params.method,
    },
    comment: coctail.comment.trim(),
    garnish: coctail.garnish,
  }

  store.addCocktail(newCocktail)

  coctail.name = ''
  coctail.ingredients = [
    {
      id: '',
      name: '',
      amount: null,
      unit: UNITS[0],
    },
  ]
  coctail.params.glass = ''
  coctail.params.ice = ''
  coctail.params.method = ''
  coctail.comment = ''
  coctail.garnish = ''
}
</script>

<style scoped>
.cocktail-form {
  position: relative;
  max-height: max-content;
  padding: 20px;
  border-radius: 5px;
  background-color: var(--black-color);
  box-shadow: var(--box-shadow);
}

.cocktail-form__content {
  flex-direction: column;
}

.cocktail-form__section {
  flex-direction: column;
  margin-bottom: 15px;
}

.cocktail-form__label {
  font-size: 12px;
  margin-bottom: 5px;
  color: var(--white-color);
}

.cocktail-form__input {
  padding: 5px;
  color: var(--black-color);
  border: 1px solid var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
}

.cocktail-form__row {
  gap: 10px;
}

.cocktail-form__row:not(:last-child) {
  margin-bottom: 15px;
}

.cocktail-form__input--ingredients {
  flex-grow: 1;
}

.cocktail-form__input--unit {
  max-width: 15%;
}

.cocktail-form__unit {
  width: 28px;
  height: 28px;
}

.cocktail-form__unit {
  padding: 5px;
  border: 1px solid var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
  font-size: 12px;
}

.cocktail-form__param {
  flex-grow: 1;
  min-width: 0;
}

.cocktail-form__param--glases {
  flex: 2;
}

.cocktail-form__param--ice {
  flex: 1;
}

.cocktail-form__param--method {
  flex: 1;
}

.cocktail-form__comment {
  outline: none;
  width: 100%;
  padding: 5px;
  font-family: Nunito;
  color: var(--black-color);
  border: 1px solid var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
  resize: none;
}

.cocktail-form__button {
  margin-bottom: 15px;
}

.cocktail-form__button--delete {
  margin: 0;
  padding: 6px 11px;
  width: 29.5px;
}

::placeholder {
  font-size: 10px;
}

:disabled {
  cursor: not-allowed;
  background-color: var(--gray-light-color);
  border-color: var(--gray-light-color);
}

:disabled:hover {
  background-color: var(--gray-light-color);
  border-color: var(--gray-light-color);
}
</style>
