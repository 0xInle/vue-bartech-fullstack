<template>
  <article class="tech__modal">
    <h3 class="tech__modal-title">
      {{ cocktail.name }}
    </h3>
    <div class="tech__modal-content">
      <section class="tech__modal-section">
        <h4 class="tech__modal-subtitle">Состав:</h4>

        <ul class="tech__modal-list list-reset">
          <li
            class="tech__modal-item"
            v-for="ingredient in cocktail.ingredients"
            :key="ingredient.id"
          >
            <span class="tech__modal-item-name">
              {{ ingredient.name }}
            </span>
            <span class="tech__modal-item-amount">
              {{ ingredient.amount }} {{ ingredient.unit }}
            </span>
          </li>
        </ul>
        <div class="tech__modal-total">{{ totalAmount }} мл</div>
      </section>
      <section class="tech__modal-section">
        <h4 class="tech__modal-subtitle">Параметры:</h4>

        <ul class="tech__modal-list list-reset">
          <li class="tech__modal-item">
            Бокал: <span>{{ cocktail.params.glass }}</span>
          </li>
          <li class="tech__modal-item">
            Лёд: <span>{{ cocktail.params.ice }}</span>
          </li>
          <li class="tech__modal-item">
            Метод: <span>{{ cocktail.params.method }}</span>
          </li>
        </ul>
      </section>
      <section v-if="cocktail.garnish" class="tech__modal-section">
        <h4 class="tech__modal-subtitle">Гарнир:</h4>
        <p class="tech__modal-text">
          {{ cocktail.garnish }}
        </p>
      </section>
      <section v-if="cocktail.comment" class="tech__modal-section">
        <h4 class="tech__modal-subtitle">Комментарий:</h4>
        <p class="tech__modal-text">
          {{ cocktail.comment }}
        </p>
      </section>
    </div>
    <div class="tech__modal-action flex">
      <UiButton @click="openEdit" class="tech__modal-btn"> Редактировать </UiButton>
      <UiButton class="tech__modal-btn" @click="deleteCocktail"> Удалить </UiButton>
    </div>
  </article>
  <UiConfirmModal
    :title="cocktail.name"
    :isOpen="isOpen"
    @cancel="handleCancel"
    @confirm="handleConfirm"
  />
</template>

<script setup lang="ts">
import UiButton from '@/components/Ui/UiButton.vue'
import UiConfirmModal from '@/components/Ui/UiConfirmModal.vue'
import { useStore } from '@/stores/store'
import type { Cocktail } from '@/type/type'
import { computed, ref } from 'vue'

const store = useStore()
const isOpen = ref(false)
const props = defineProps<{
  cocktail: Cocktail
}>()

const totalAmount = computed(() => {
  return props.cocktail.ingredients.reduce((sum, ing) => sum + (ing.amount ?? 0), 0)
})

const emit = defineEmits<{
  (e: 'edit', cocktail: Cocktail): void
  (e: 'close'): void
}>()

function openEdit() {
  emit('close')
  emit('edit', props.cocktail)
}

function deleteCocktail() {
  isOpen.value = true
}

function handleConfirm() {
  store.removeItemById(store.cocktailsLib, props.cocktail.id)
  isOpen.value = false
  emit('close')
}

function handleCancel() {
  isOpen.value = false
}
</script>

<style scoped>
.tech__modal-title {
  margin: 0;
  margin-bottom: 20px;
  text-align: center;
  padding: 10px;
  background-color: var(--white-color);
  border: 1px solid var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
}

.tech__modal-content {
  margin-bottom: 20px;
  padding: 10px;
  background-color: var(--white-color);
  border: 1px solid var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
}

.tech__modal-subtitle {
  margin: 0;
  margin-bottom: 10px;
  max-width: max-content;
  font-size: 12px;
  font-weight: 400;
  border-bottom: 1px solid var(--black-color);
}

.tech__modal-section {
  margin-bottom: 10px;
}

.tech__modal-item {
  display: flex;
  justify-content: space-between;
  font-weight: 400;
  font-size: 12px;
}

.tech__modal-total {
  padding-top: 5px;
  text-align: end;
  text-decoration: underline;
  font-weight: 400;
  font-size: 12px;
}

.tech__modal-text {
  font-weight: 400;
  font-size: 12px;
}

.tech__modal-action {
  gap: 20px;
  justify-content: space-between;
}

.tech__modal-btn {
  flex: 1;
  background-color: var(--green-bright-color);
}
</style>
