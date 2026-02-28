<template>
  <UIModal :isOpen="isOpen" @close="cancel">
    <div class="modal">
      <p class="modal__descr">Вы уверены, что хотите удалить {{ title }}?</p>
      <div class="modal__actions flex">
        <UiButton class="modal__button" @click="confirm"> Подтвердить </UiButton>
        <UiButton class="modal__button" @click="cancel"> Отменить </UiButton>
      </div>
    </div>
  </UIModal>
</template>

<script setup lang="ts">
import UiButton from './UiButton.vue'
import UIModal from './UIModal.vue'

defineProps<{
  title: string
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

function confirm() {
  emit('confirm')
}

function cancel() {
  emit('cancel')
}
</script>

<style scoped>
.modal {
  padding: 20px;
  background-color: var(--white-color);
  border-radius: 10px;
}

.modal__descr {
  margin: 0 0 20px;
  text-align: center;
}

.modal__actions {
  gap: 20px;
}

.modal__button {
  flex: 1;
}
</style>
