<template>
  <div class="ingredient-form">
    <form class="ingredient-form__content flex" @submit.prevent="createIngredient">
      <div class="ingredient-form__section flex">
        <label class="ingredient-form__label"> Название: </label>
        <UiInput
          v-model="customIngredient.name"
          type="text"
          class="ingredient-form__input"
          placeholder="Название ингредиента"
        />
      </div>
      <div class="ingredient-form__section flex">
        <label class="ingredient-form__label"> Ингредиенты: </label>
        <div
          class="ingredient-form__row flex"
          v-for="ingredient in customIngredient.ingredients"
          :key="ingredient.id"
        >
          <UiInput
            v-model="ingredient.name"
            type="text"
            class="ingredient-form__input ingredient-form__input--ingredients"
            placeholder="Название ингредиента"
          />
          <UiInput
            v-model.number="ingredient.amount"
            type="text"
            class="ingredient-form__input ingredient-form__input--unit"
            placeholder="Объем"
          />
          <UiSelect v-model="ingredient.unit" :placeholder="UNITS[0]" :options="UNITS" />
          <UiButton
            :disabled="customIngredient.ingredients.length === 1"
            @click="removeIngredient(ingredient.id)"
            class="ingredient-form__button ingredient-form__button--delete"
          >
            x
          </UiButton>
        </div>
      </div>
      <UiButton class="ingredient-form__button btn-reset" @click="addIngredient"
        >Добавить ингредиент</UiButton
      >
      <div class="ingredient-form__section flex">
        <label class="ingredient-form__label"> Комментарий: </label>
        <textarea v-model="customIngredient.comment" class="ingredient-form__comment" rows="5">
        </textarea>
      </div>
      <div class="ingredient-form__actions flex">
        <UiButton type="submit" class="ingredient-form__button btn-reset">
          Создать ингредиент
        </UiButton>
        <UiButton type="button" class="ingredient-form__button" @click="closeForm"
          >Закрыть форму</UiButton
        >
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { CustomIngredient } from '@/type/type'
import { reactive } from 'vue'
import { UNITS } from '@/type/consts'
import { useStore } from '@/stores/store'
import UiInput from '@/components/Ui/UiInput.vue'
import UiButton from '@/components/Ui/UiButton.vue'
import UiSelect from '@/components/Ui/UiSelect.vue'
import { v4 as uuidv4 } from 'uuid'

const emit = defineEmits(['close'])
const store = useStore()

const customIngredient = reactive<CustomIngredient>({
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
  comment: '',
})

function addIngredient() {
  customIngredient.ingredients.push({
    id: uuidv4(),
    name: '',
    amount: null,
    unit: UNITS[0],
  })
}

function removeIngredient(id: string) {
  if (customIngredient.ingredients.length > 1) {
    customIngredient.ingredients = customIngredient.ingredients.filter((i) => i.id !== id)
  }
}

function createIngredient() {
  const newIngredient: CustomIngredient = {
    id: uuidv4(),
    name: customIngredient.name.trim(),
    ingredients: customIngredient.ingredients.map((i) => ({
      id: uuidv4(),
      name: i.name.trim(),
      amount: i.amount,
      unit: i.unit || UNITS[0],
    })),
    comment: customIngredient.comment.trim(),
  }
  store.addCustomIngredient(newIngredient)

  customIngredient.name = ''
  customIngredient.ingredients = [{ id: '', name: '', amount: null, unit: UNITS[0] }]
  customIngredient.comment = ''
}

function closeForm() {
  emit('close')
}
</script>

<style scoped>
.ingredient-form {
  padding: 20px;
  position: relative;
  max-height: max-content;
  border-radius: 5px;
  box-shadow: var(--box-shadow);
  background-color: var(--black-color);
}

.ingredient-form__content {
  flex-direction: column;
}

.ingredient-form__section {
  flex-direction: column;
  margin-bottom: 15px;
}

.ingredient-form__label {
  color: var(--white-color);
  font-size: 12px;
  margin-bottom: 5px;
}

.ingredient-form__input {
  padding: 5px;
  border: 1px solid var(--black-color);
  color: var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
}

.ingredient-form__row {
  gap: 10px;
}

.ingredient-form__row:not(:last-child) {
  margin-bottom: 15px;
}

.ingredient-form__input--ingredients {
  flex-grow: 1;
}

.ingredient-form__input--unit {
  max-width: 15%;
}

.ingredient-form__comment {
  width: 100%;
  padding: 5px;
  border: 1px solid var(--black-color);
  color: var(--black-color);
  outline: none;
  /* stylelint-disable-next-line font-family-no-missing-generic-family-keyword */
  font-family: Nunito;
  border-radius: 5px;
  box-shadow: var(--box-shadow);
  resize: none;
  transition: all 0.3s ease-in-out;

  &:focus {
    border: 1px solid var(--green-bright-color);
    box-shadow: 0 0 10px rgb(134 194 50 / 30%);
  }
}

.ingredient-form__button {
  flex: 1;
}

.ingredient-form__button--delete {
  width: 29.5px;
  padding: 6px 11px;
  margin: 0;
}

.ingredient-form__actions {
  gap: 20px;
}

::placeholder {
  font-size: 10px;
}

:disabled {
  cursor: not-allowed;
  background-color: var(--gray-light-color);
  border-color: var(--gray-light-color);
}
</style>
