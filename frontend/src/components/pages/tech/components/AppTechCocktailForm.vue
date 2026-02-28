<template>
  <div class="cocktail-form" ref="target">
    <form class="cocktail-form__content flex" @submit.prevent="createCocktail">
      <div class="cocktail-form__section flex">
        <label class="cocktail-form__label"> Название: </label>
        <UiInput
          v-model="cocktail.name"
          type="text"
          class="cocktail-form__input"
          placeholder="Название коктейля"
        />
      </div>
      <div class="cocktail-form__section flex">
        <label class="cocktail-form__label"> Ингредиенты: </label>
        <div
          class="cocktail-form__row flex"
          v-for="ingredient in cocktail.ingredients"
          :key="ingredient.id"
        >
          <UiInput
            v-model="ingredient.name"
            type="text"
            class="cocktail-form__input cocktail-form__input--ingredients"
            placeholder="Название ингредиента"
          />
          <UiInput
            v-model.number="ingredient.amount"
            type="text"
            class="cocktail-form__input cocktail-form__input--unit"
            placeholder="Объем"
          />
          <UiSelect v-model="ingredient.unit" :placeholder="UNITS[0]" :options="UNITS" />
          <UiButton
            :disabled="cocktail.ingredients.length === 1"
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
        v-if="cocktail.ingredients.length < 20"
        >Добавить ингредиент</UiButton
      >
      <div class="cocktail-form__section flex">
        <label class="cocktail-form__label"> Описание: </label>
        <div class="cocktail-form__row flex">
          <UiSelect
            v-model="cocktail.params.glass"
            :options="GLASS"
            placeholder="Бокал"
            class="cocktail-form__param cocktail-form__param--glasses"
          />
          <UiSelect
            v-model="cocktail.params.ice"
            :options="ICE"
            placeholder="Лед"
            class="cocktail-form__param cocktail-form__param--ice"
          />
          <UiSelect
            v-model="cocktail.params.method"
            :options="METHOD"
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
          v-model="cocktail.garnish"
          class="cocktail-form__input"
        />
      </div>
      <div class="cocktail-form__section flex">
        <label class="cocktail-form__label"> Комментарий: </label>
        <textarea v-model="cocktail.comment" class="cocktail-form__comment" rows="5"> </textarea>
      </div>
      <UiButton type="submit" class="cocktail-form__button btn-reset"> Создать коктейль </UiButton>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { Cocktail } from '@/type/type'
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

const cocktail = reactive<Cocktail>({
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
  cocktail.ingredients.push({
    id: uuidv4(),
    name: '',
    amount: null,
    unit: UNITS[0],
  })
}

function delIngredient(id: string) {
  if (cocktail.ingredients.length > 1) {
    cocktail.ingredients = cocktail.ingredients.filter((i) => i.id !== id)
  }
}

function createCocktail() {
  const newCocktail: Cocktail = {
    id: uuidv4(),
    name: cocktail.name.trim(),
    ingredients: cocktail.ingredients.map((i) => ({
      id: uuidv4(),
      name: i.name.trim(),
      amount: i.amount,
      unit: i.unit || UNITS[0],
    })),
    params: {
      glass: cocktail.params.glass,
      ice: cocktail.params.ice,
      method: cocktail.params.method,
    },
    comment: cocktail.comment.trim(),
    garnish: cocktail.garnish,
  }

  store.addCocktail(newCocktail)

  cocktail.name = ''
  cocktail.ingredients = [
    {
      id: '',
      name: '',
      amount: null,
      unit: UNITS[0],
    },
  ]
  cocktail.params.glass = ''
  cocktail.params.ice = ''
  cocktail.params.method = ''
  cocktail.comment = ''
  cocktail.garnish = ''
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

.cocktail-form__param--glasses {
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
  border: 1px solid (--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
  resize: none;
  transition: all 0.3s ease-in-out;

  &:focus {
    box-shadow: 0 0 10px rgba(134, 194, 50, 0.3);
    border: 1px solid var(--green-bright-color);
  }
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
