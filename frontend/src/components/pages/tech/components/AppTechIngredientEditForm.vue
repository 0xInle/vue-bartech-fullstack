<template>
  <div class="ingredient-form" ref="target">
    <form class="ingredient-form__content flex" @submit.prevent>
      <div class="ingredient-form__section flex">
        <label class="ingredient-form__label"> Название: </label>
        <UiInput
          v-model="localIngredient.name"
          type="text"
          class="ingredient-form__input"
          placeholder="Название ингридиента"
        />
      </div>
      <div class="ingredient-form__section flex">
        <label class="ingredient-form__label"> Ингридиенты: </label>
        <div
          class="ingredient-form__row flex"
          v-for="ingredient in localIngredient.ingredients"
          :key="ingredient.id"
        >
          <UiInput
            v-model="ingredient.name"
            type="text"
            class="ingredient-form__input ingredient-form__input--ingredients"
            placeholder="Название ингридиента"
          />
          <UiInput
            v-model.number="ingredient.amount"
            type="text"
            class="ingredient-form__input ingredient-form__input--unit"
            placeholder="Объем"
          />
          <UiSelect v-model="ingredient.unit" :placeholder="UNITS[0]" :selectArr="UNITS" />
          <UiButton
            :disabled="localIngredient.ingredients.length === 1"
            @click="delIngredient(ingredient.id)"
            class="ingredient-form__button ingredient-form__button--delete"
          >
            x
          </UiButton>
        </div>
      </div>
      <UiButton class="ingredient-form__button btn-reset" @click="addIngredient"
        >Добавить ингридиент</UiButton
      >
      <div class="ingredient-form__section flex">
        <label class="ingredient-form__label"> Комментарий: </label>
        <textarea v-model="localIngredient.comment" class="ingredient-form__comment" rows="5">
        </textarea>
      </div>
      <UiButton type="submit" @click="close" class="ingredient-form__button btn-reset">
        Редактировать ингридиент
      </UiButton>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { CustomIngredient } from '@/type/type'
import { useTemplateRef, reactive } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { UNITS } from '@/type/consts'
import UiInput from '@/components/Ui/UiInput.vue'
import UiButton from '@/components/Ui/UiButton.vue'
import UiSelect from '@/components/Ui/UiSelect.vue'
import { v4 as uuidv4 } from 'uuid'

const props = defineProps<{
  ingredient: CustomIngredient
}>()
const emit = defineEmits(['close'])
const localIngredient = reactive(props.ingredient)
const target = useTemplateRef('target')

function close() {
  emit('close')
}

function addIngredient() {
  localIngredient.ingredients.push({
    id: uuidv4(),
    name: '',
    amount: null,
    unit: UNITS[0],
  })
}

function delIngredient(id: string) {
  if (localIngredient.ingredients.length > 1) {
    localIngredient.ingredients = localIngredient.ingredients.filter((i) => i.id !== id)
  }
}

onClickOutside(target, () => {
  emit('close')
})
</script>

<style scoped>
.ingredient-form {
  position: relative;
  max-height: max-content;
  padding: 20px;
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
  font-size: 12px;
  margin-bottom: 5px;
  color: var(--white-color);
}

.ingredient-form__input {
  padding: 5px;
  color: var(--black-color);
  border: 1px solid var(--black-color);
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

.ingredient-form__unit {
  width: 28px;
  height: 28px;
}

.ingredient-form__unit {
  padding: 5px;
  border: 1px solid var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
  font-size: 12px;
}

.ingredient-form__param {
  flex-grow: 1;
  min-width: 0;
}

.ingredient-form__param--glases {
  flex: 2;
}

.ingredient-form__param--ice {
  flex: 1;
}

.ingredient-form__param--method {
  flex: 1;
}

.ingredient-form__comment {
  outline: none;
  width: 100%;
  padding: 5px;
  font-family: Nunito;
  color: var(--black-color);
  border: 1px solid var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
  resize: none;
  transition: all 0.3s ease-in-out;

  &:focus {
    box-shadow: 0 0 10px rgba(134, 194, 50, 0.3);
    border: 1px solid var(--green-bright-color);
  }
}

.ingredient-form__button {
  color: var(--white-color);
  background-color: var(--black-color);
  margin-bottom: 15px;
}

.ingredient-form__button--delete {
  margin: 0;
  padding: 6px 11px;
  width: 29.5px;
}

::placeholder {
  font-size: 10px;
}

:disabled {
  cursor: not-allowed;
  background-color: rgb(53, 53, 53);
}
</style>
