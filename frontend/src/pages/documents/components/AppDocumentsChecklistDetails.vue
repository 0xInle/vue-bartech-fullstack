<template>
  <div class="checklist-edit">
    <div class="checklist-edit__header flex">
      <h3 class="checklist-edit__title">Редактирование чеклиста</h3>
      <UiButton class="checklist-edit__button checklist-edit__button--add" @click="addTask"
        >Добавить задачу</UiButton
      >
    </div>
    <div class="checklist-edit__field flex">
      <label class="checklist-edit__label">Название:</label>
      <UiInput placeholder="" class="checklist-edit__input" type="text" v-model="localToDo.name" />
    </div>
    <div class="checklist-edit__field flex">
      <label class="checklist-edit__label">Описание:</label>
      <ol class="checklist-edit__tasks">
        <li v-for="task in localToDo.tasks" :key="task.id" class="checklist-edit__task">
          <div class="checklist-edit__task-row flex">
            <UiInput
              placeholder=""
              class="checklist-edit__task-input"
              v-model="task.name"
              type="text"
            />
            <UiButton
              :disabled="localToDo.tasks.length === 1"
              @click="delIngredient(task.id)"
              class="checklist-edit__task-button checklist-edit__task-button--delete"
            >
              x
            </UiButton>
          </div>
        </li>
      </ol>
    </div>
    <div class="checklist-edit__actions flex">
      <UiButton
        class="checklist-edit__actions-button checklist-edit__actions-button--save"
        @click="saveTask"
        >Сохранить</UiButton
      >
      <UiButton class="checklist-edit__actions-button checklist-edit__actions-button--clear"
        >Очистить</UiButton
      >
      <UiButton class="checklist-edit__actions-button checklist-edit__actions-button--close"
        >Закрыть</UiButton
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import UiButton from '@/components/Ui/UiButton.vue'
import UiInput from '@/components/Ui/UiInput.vue'
import { useStore } from '@/stores/store'
import type { ToDo } from '@/type/type'
import { ref } from 'vue'

const store = useStore()

const prop = defineProps<{
  toDo: ToDo
}>()

const emit = defineEmits<{
  (e: 'closeDetailsModal'): void
}>()

const localToDo = ref<ToDo>(JSON.parse(JSON.stringify(prop.toDo)))

function delIngredient(id: string) {
  localToDo.value.tasks = localToDo.value.tasks.filter((i) => i.id !== id)
}

function saveTask() {
  store.updateToDoTask(localToDo.value)
  emit('closeDetailsModal')
}

function addTask() {
  localToDo.value.tasks.push({
    id: '',
    name: '',
    done: false,
  })
}
</script>

<style scoped>
.checklist-edit {
  padding: 20px;
  background-color: var(--white-color);
  border-radius: 10px;
}

.checklist-edit__header {
  justify-content: space-between;
  max-height: 29.5px;
  margin-bottom: 10px;
  gap: 20px;
}

.checklist-edit__title {
  display: block;
  max-width: 100%;
  margin: 0;
  border: 1px solid var(--black-color);
  color: var(--black-color);
  text-align: center;
  flex: 1;
  font-size: 21px;
  font-weight: 900;
  box-shadow: var(--box-shadow);
  border-radius: 5px;
}

/* .checklist-edit__button {
  width: 50%;
  align-self: center;
} */

.checklist-edit__field {
  flex-direction: column;
  margin-bottom: 10px;
}

.checklist-edit__label {
  color: var(--black-color);
  font-size: 12px;
  margin-bottom: 5px;
}

.checklist-edit__input {
  padding: 5px;
  border: 1px solid var(--black-color);
  color: var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
}

.checklist-edit__tasks {
  margin: 0;
  color: var(--black-color);
  margin-bottom: 10px;
  padding-left: 15px;
  font-size: 12px;
}

.checklist-edit__task:not(:last-child) {
  margin-bottom: 10px;
}

.checklist-edit__task-row {
  gap: 10px;
}

.checklist-edit__task-input {
  padding: 5px;
  border: 1px solid var(--black-color);
  color: var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
}

.checklist-edit__task-button--delete {
  width: 29.5px;
  padding: 6px 11px;
  margin: 0;
}

.checklist-edit__actions {
  justify-content: flex-end;
  width: 50%;
  margin-left: auto;
  gap: 10px;
  margin-top: 20px;
}

.checklist-edit__actions-button {
  flex: 1;
}
</style>
