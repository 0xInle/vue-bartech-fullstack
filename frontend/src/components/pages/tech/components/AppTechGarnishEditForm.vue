<template>
  <div class="garnish-form" ref="target">
    <form class="garnish-form__content flex" @submit.prevent>
      <div class="garnish-form__section flex">
        <label class="garnish-form__label"> Название: </label>
        <UiInput
          v-model="localGarnish.name"
          type="text"
          class="garnish-form__input"
          placeholder="Название гарнира"
        />
      </div>
      <div class="garnish-form__section flex">
        <label class="garnish-form__label"> Ингредиенты: </label>
        <div
          class="garnish-form__row flex"
          v-for="ingredient in localGarnish.ingredients"
          :key="ingredient.id"
        >
          <UiInput
            v-model="ingredient.name"
            type="text"
            class="garnish-form__input garnish-form__input--ingredients"
            placeholder="Название ингредиента"
          />
          <UiInput
            v-model.number="ingredient.amount"
            type="text"
            class="garnish-form__input garnish-form__input--unit"
            placeholder="Объем"
          />
          <UiSelect v-model="ingredient.unit" :placeholder="UNITS[0]" :options="UNITS" />
          <UiButton
            :disabled="localGarnish.ingredients.length === 1"
            @click="delGarnish(ingredient.id)"
            class="garnish-form__button garnish-form__button--delete"
          >
            x
          </UiButton>
        </div>
      </div>
      <UiButton class="garnish-form__button btn-reset" @click="addGarnish"
        >Добавить ингредиент</UiButton
      >
      <div class="garnish-form__section flex">
        <label class="garnish-form__label"> Комментарий: </label>
        <textarea v-model="localGarnish.comment" class="garnish-form__comment" rows="5"> </textarea>
      </div>
      <UiButton type="submit" @click="close" class="garnish-form__button btn-reset">
        Создать гарнир
      </UiButton>
    </form>
  </div>
</template>

<script setup lang="ts">
import type { CustomGarnish } from '@/type/type'
import { useTemplateRef, reactive } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { UNITS } from '@/type/consts'
import UiInput from '@/components/Ui/UiInput.vue'
import UiButton from '@/components/Ui/UiButton.vue'
import UiSelect from '@/components/Ui/UiSelect.vue'
import { v4 as uuidv4 } from 'uuid'

const props = defineProps<{
  garnish: CustomGarnish
}>()
const emit = defineEmits(['close'])
const localGarnish = reactive(props.garnish)
const target = useTemplateRef('target')

function close() {
  emit('close')
}

function addGarnish() {
  localGarnish.ingredients.push({
    id: uuidv4(),
    name: '',
    amount: null,
    unit: UNITS[0],
  })
}

function delGarnish(id: string) {
  if (localGarnish.ingredients.length > 1) {
    localGarnish.ingredients = localGarnish.ingredients.filter((i) => i.id !== id)
  }
}

onClickOutside(target, () => {
  emit('close')
})
</script>

<style scoped>
.garnish-form {
  position: relative;
  max-height: max-content;
  padding: 20px;
  border-radius: 5px;
  box-shadow: var(--box-shadow);
  background-color: var(--black-color);
}

.garnish-form__content {
  flex-direction: column;
}

.garnish-form__section {
  flex-direction: column;
  margin-bottom: 15px;
}

.garnish-form__label {
  font-size: 12px;
  margin-bottom: 5px;
  color: var(--white-color);
}

.garnish-form__input {
  padding: 5px;
  color: var(--black-color);
  border: 1px solid var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
}

.garnish-form__row {
  gap: 10px;
}

.garnish-form__row:not(:last-child) {
  margin-bottom: 15px;
}

.garnish-form__input--ingredients {
  flex-grow: 1;
}

.garnish-form__input--unit {
  max-width: 15%;
}

.garnish-form__unit {
  width: 28px;
  height: 28px;
}

.garnish-form__unit {
  padding: 5px;
  border: 1px solid var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
  font-size: 12px;
}

.garnish-form__param {
  flex-grow: 1;
  min-width: 0;
}

.garnish-form__param--glasses {
  flex: 2;
}

.garnish-form__param--ice {
  flex: 1;
}

.garnish-form__param--method {
  flex: 1;
}

.garnish-form__comment {
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

.garnish-form__button {
  color: var(--white-color);
  background-color: var(--black-color);
  margin-bottom: 15px;
}

.garnish-form__button--delete {
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
