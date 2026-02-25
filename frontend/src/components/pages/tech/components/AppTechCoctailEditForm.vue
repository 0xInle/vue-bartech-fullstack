<template>
  <div class="cocktail-form" ref="target">
    <form class="cocktail-form__content flex" @submit.prevent>
      <div class="cocktail-form__section flex">
        <label class="cocktail-form__label"> Название: </label>
        <UiInput
          v-model="localCocktail.name"
          type="text"
          class="cocktail-form__input"
          placeholder="Название напитка"
        />
      </div>
      <div class="cocktail-form__section flex">
        <label class="cocktail-form__label"> Ингридиенты: </label>
        <div
          class="cocktail-form__row flex"
          v-for="ingredient in localCocktail.ingredients"
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
            :disabled="localCocktail.ingredients.length === 1"
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
        v-if="localCocktail.ingredients.length < 20"
        >Добавить ингридиент</UiButton
      >
      <div class="cocktail-form__section flex">
        <label class="cocktail-form__label"> Описание: </label>
        <div class="cocktail-form__row flex">
          <UiSelect
            v-model="localCocktail.params.glass"
            :selectArr="GLASS"
            placeholder="Бокал"
            class="cocktail-form__param cocktail-form__param--glases"
          />
          <UiSelect
            v-model="localCocktail.params.ice"
            :selectArr="ICE"
            placeholder="Лед"
            class="cocktail-form__param cocktail-form__param--ice"
          />
          <UiSelect
            v-model="localCocktail.params.method"
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
          v-model="localCocktail.garnish"
          class="cocktail-form__input"
        />
      </div>
      <div class="cocktail-form__section flex">
        <label class="cocktail-form__label"> Комментарий: </label>
        <textarea v-model="localCocktail.comment" class="cocktail-form__comment" rows="5">
        </textarea>
      </div>
      <div class="coctail-form__actions flex">
        <UiButton type="submit" @click="close" class="cocktail-form__button">
          Отредактировать коктейль
        </UiButton>
        <UiButton class="cocktail-form__button">Отменить изменения</UiButton>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { useTemplateRef, reactive } from 'vue'
import UiInput from '@/components/Ui/UiInput.vue'
import UiButton from '@/components/Ui/UiButton.vue'
import UiSelect from '@/components/Ui/UiSelect.vue'
import { UNITS, GLASS, ICE, METHOD } from '@/type/consts'
import { onClickOutside } from '@vueuse/core'
import type { Coctail } from '@/type/type'
import { v4 as uuidv4 } from 'uuid'

const props = defineProps<{
  coctail: Coctail
}>()
const emit = defineEmits(['close'])
const target = useTemplateRef('target')
const localCocktail = reactive(props.coctail)

function delIngredient(id: string) {
  if (localCocktail.ingredients.length > 1) {
    localCocktail.ingredients = localCocktail.ingredients.filter((i) => i.id !== id)
  }
}

function addIngredient() {
  localCocktail.ingredients.push({
    id: uuidv4(),
    name: '',
    amount: null,
    unit: UNITS[0],
  })
}

function close() {
  emit('close')
}

onClickOutside(target, () => {
  emit('close')
})
</script>

<style scoped>
.cocktail-form {
  position: relative;
  max-height: max-content;
  padding: 20px;
  border-radius: 5px;
  box-shadow: var(--box-shadow);
  background-color: var(--black-color);
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
  flex: 1;
}

.cocktail-form__button--delete {
  margin: 0;
  padding: 6px 11px;
  width: 29.5px;
}

.coctail-form__actions {
  gap: 20px;
}

::placeholder {
  font-size: 10px;
}

:disabled {
  cursor: not-allowed;
  background-color: var(--gray-light-color);
}
</style>
