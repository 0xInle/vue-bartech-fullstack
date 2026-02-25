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
  max-height: 29.5px;
  justify-content: space-between;
  margin-bottom: 10px;
  gap: 20px;
}

.checklist-edit__title {
  display: block;
  flex: 1;
  text-align: center;
  max-width: 100%;
  margin: 0;
  font-size: 21px;
  font-weight: 900;
  color: var(--black-color);
  border: 1px solid var(--black-color);
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
  font-size: 12px;
  margin-bottom: 5px;
  color: var(--black-color);
}
.checklist-edit__input {
  padding: 5px;
  color: var(--black-color);
  border: 1px solid var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
}
.checklist-edit__tasks {
  margin: 0;
  margin-bottom: 10px;
  padding-left: 15px;
  font-size: 12px;
  color: var(--black-color);
}

.checklist-edit__task:not(:last-child) {
  margin-bottom: 10px;
}

.checklist-edit__task-row {
  gap: 10px;
}
.checklist-edit__task-input {
  padding: 5px;
  color: var(--black-color);
  border: 1px solid var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
}

.checklist-edit__task-button--delete {
  margin: 0;
  padding: 6px 11px;
  width: 29.5px;
}

.checklist-edit__actions {
  margin-left: auto;
  width: 50%;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.checklist-edit__actions-button {
  flex: 1;
}
</style>
