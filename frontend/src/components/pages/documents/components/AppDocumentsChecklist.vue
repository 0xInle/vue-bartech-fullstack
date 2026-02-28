<template>
  <section class="checklist">
    <div class="checklist__body flex">
      <UiDecorationBlock class="checklist__list-block">
        <header class="checklist__header flex">
          <h2 class="checklist__title">Список чеклистов</h2>
          <div class="checklist__actions">
            <UiButton @click="showForm = true" class="checklist__new-btn"> Новый чеклист </UiButton>
          </div>
        </header>
        <ul class="checklist__list list-reset">
          <li class="checklist__item" v-for="toDo in toDoLib" :key="toDo.id">
            <div class="checklist__item-block flex" tabindex="0" @click="toggleAccordion(toDo.id)">
              <span class="checklist__item-name" :class="{ 'checklist__item-name-sm': showForm }">{{
                toDo.name
              }}</span>
              <div class="checklist__item-action flex" @click.stop>
                <UiButton @click="editToDo(toDo)">Редактировать</UiButton>
                <UiButton>Печать</UiButton>
                <UiButton @click="handleDelete(toDo.id)">Удалить</UiButton>
              </div>
            </div>
            <ol v-if="openedId === toDo.id" class="checklist__tasks">
              <li v-for="task in toDo.tasks" :key="task.id" class="checklist__task">
                {{ task.name }}
              </li>
            </ol>
          </li>
        </ul>
      </UiDecorationBlock>
      <UiDecorationBlock v-if="showForm" class="checklist__form-block" ref="target">
        <AppDocumentsForm @closeForm="showForm = false" />
      </UiDecorationBlock>
    </div>
    <UIModal :isOpen="showModal" @close="showModal = false" size="md">
      <AppDocumentsChecklistDetails
        class="checklist__modal-details"
        v-if="selectedToDo"
        :toDo="selectedToDo"
        @closeDetailsModal="showModal = false"
      />
    </UIModal>
  </section>
</template>

<script setup lang="ts">
import UiButton from '@/components/Ui/UiButton.vue'
import UiDecorationBlock from '@/components/Ui/UiDecorationBlock.vue'
import AppDocumentsForm from './AppDocumentsForm.vue'
import { useStore } from '@/stores/store'
import { storeToRefs } from 'pinia'
import { ref, useTemplateRef } from 'vue'
import { onClickOutside } from '@vueuse/core'
import UIModal from '@/components/Ui/UIModal.vue'
import AppDocumentsChecklistDetails from './AppDocumentsChecklistDetails.vue'
import type { ToDo } from '@/type/type'

const showForm = ref(false)
const openedId = ref<string | null>(null)
const target = useTemplateRef('target')
const store = useStore()
const { toDoLib } = storeToRefs(store)
const showModal = ref(false)
const selectedToDo = ref<ToDo | null>(null)

function editToDo(toDo: ToDo) {
  selectedToDo.value = toDo
  showModal.value = true
}

function handleDelete(id: string) {
  store.removeToDo(id)
}

onClickOutside(target, () => {
  showForm.value = false
})

function toggleAccordion(id: string) {
  openedId.value = openedId.value === id ? null : id
}
</script>

<style scoped>
.checklist__body {
  width: 100%;
  gap: 20px;
}

.checklist__list-block {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: calc(100vh - 118.5px);
}
.checklist__header {
  gap: 20px;
  justify-content: space-between;
  margin-bottom: 20px;
}
.checklist__title {
  display: block;
  flex: 1;
  text-align: center;
  max-width: 100%;
  margin: 0;
  font-size: 21px;
  font-weight: 900;
  color: var(--black-color);
  background-color: var(--white-color);
  border-radius: 5px;
}

.checklist__list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  border: 1px solid var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
  background-color: var(--white-color);
}

.checklist__item:not(:last-child) {
  margin-bottom: 10px;
}

.checklist__item-block {
  outline: none;
  justify-content: space-between;
  gap: 20px;
  align-items: center;
  width: 100%;
  padding: 5px;
  font-size: 14px;
  font-weight: 700;
  border: 1px solid var(--black-color);
  background-color: transparent;
  border-radius: 5px;
  box-shadow: var(--box-shadow);
  text-align: start;
  margin-bottom: 10px;
  transition: all 0.3s ease-in-out;

  &:hover {
    cursor: pointer;
    color: var(--white-color);
    background-color: var(--gray-dark-color);
  }

  &:focus {
    color: var(--white-color);
    background-color: var(--gray-dark-color);
    border-color: var(--gray-dark-color);
  }
}

.checklist__item-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 793px;
}

.checklist__item-name-sm {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 198px;
}

.checklist__item-action {
  gap: 20px;
}

.checklist__tasks {
  padding: 10px 10px 10px 30px;
  border: 1px solid var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
}

.checklist__task {
  font-size: 14px;
  font-weight: 500;
}

.checklist__form-block {
  flex: 1;
  max-height: max-content;
}
</style>
