<template>
  <article class="tech__modal">
    <h3 class="tech__modal-title">
      {{ garnish.name }}
    </h3>
    <div class="tech__modal-content">
      <section class="tech__modal-section">
        <h4 class="tech__modal-subtitle">Состав:</h4>

        <ul class="tech__modal-list list-reset">
          <li class="tech__modal-item" v-for="item in garnish.ingredients" :key="item.id">
            <span class="tech__modal-item-name">
              {{ item.name }}
            </span>

            <span class="tech__modal-item-amount"> {{ item.amount }} {{ item.unit }} </span>
          </li>
        </ul>
      </section>
      <section v-if="garnish.comment" class="tech__modal-section">
        <h4 class="tech__modal-subtitle">Комментарий:</h4>
        <p class="tech__modal-text">
          {{ garnish.comment }}
        </p>
      </section>
    </div>
    <div class="tech__modal-action flex">
      <UiButton @click="openEdit" class="tech__modal-btn"> Редактировать </UiButton>
      <UiButton class="tech__modal-btn" @click="deleteGarnish"> Удалить </UiButton>
    </div>
  </article>
  <UiConfirmModal
    :title="garnish.name"
    :isOpen="isOpen"
    @cancel="handleCancel"
    @confirm="handleConfirm"
  />
</template>

<script setup lang="ts">
import type { CustomGarnish } from '@/type/type'
import UiButton from '@/components/Ui/UiButton.vue'
import UiConfirmModal from '@/components/Ui/UiConfirmModal.vue'
import { useStore } from '@/stores/store'
import { ref } from 'vue'

const store = useStore()
const isOpen = ref(false)

const props = defineProps<{
  garnish: CustomGarnish
}>()

const emit = defineEmits<{
  (e: 'edit', garnish: CustomGarnish): void
  (e: 'close'): void
}>()

function openEdit() {
  emit('close')
  emit('edit', props.garnish)
}

function deleteGarnish() {
  isOpen.value = true
}

function handleConfirm() {
  store.removeItemById(store.customGarnishLib, props.garnish.id)

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

.tech__modal-list {
  margin-bottom: 10px;
}

.tech__modal-item {
  display: flex;
  justify-content: space-between;
  font-weight: 400;
  font-size: 12px;
}

.tech__modal-total {
  text-align: end;
  text-decoration: underline;
  font-weight: 600;
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
  color: var(--black-color);
  background-color: var(--green-bright-color);
}
</style>
