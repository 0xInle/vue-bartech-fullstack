<template>
  <form class="documents-form" @submit.prevent="submitForm">
    <div class="documents-form__field">
      <label class="documents-form__label">Название:</label>
      <UiInput
        class="documents-form__input"
        type="text"
        placeholder="Введите название"
        v-model="toDo.name"
      />
    </div>
    <label class="documents-form__section-label">Описание:</label>
    <div v-for="task in toDo.tasks" :key="task.id" class="documents-form__field flex">
      <div class="documents-form__field-row flex">
        <UiInput
          class="documents-form__input"
          type="text"
          placeholder="Введите задачу"
          v-model="task.name"
        />
        <UiButton
          type="button"
          :disabled="toDo.tasks.length === 1"
          @click="delTasks(task.id)"
          class="documents-form__button documents-form__button--delete"
        >
          x
        </UiButton>
      </div>
    </div>
    <UiButton
      v-if="toDo.tasks.length < 30"
      class="documents-form__button"
      type="button"
      @click="addTask"
    >
      Добавить задачу
    </UiButton>
    <div class="documents-form__actions flex">
      <UiButton class="documents-form__button" type="submit"> Создать чеклист </UiButton>
      <UiButton class="documents-form__button" type="button" @click="resetForm">
        Очистить чеклист
      </UiButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ToDo } from '@/type/type'
import UiButton from '@/components/Ui/UiButton.vue'
import UiInput from '@/components/Ui/UiInput.vue'
import { v4 as uuidv4 } from 'uuid'
import { useStore } from '@/stores/store'

const store = useStore()

const toDo = ref<ToDo>({
  id: uuidv4(),
  name: '',
  tasks: [
    {
      id: uuidv4(),
      name: '',
      done: false,
    },
  ],
})

function addTask() {
  toDo.value.tasks.push({
    id: uuidv4(),
    name: '',
    done: false,
  })
}

function submitForm() {
  const newTodo: ToDo = {
    id: uuidv4(),
    name: toDo.value.name,
    tasks: toDo.value.tasks.map((i) => ({
      id: i.id,
      name: i.name.trim(),
      done: false,
    })),
  }
  store.addToDo(newTodo)
  resetForm()
}

function resetForm() {
  toDo.value.name = ''
  toDo.value.id = ''
  toDo.value.tasks = [
    {
      id: '',
      name: '',
      done: false,
    },
  ]
}

function delTasks(id: string) {
  toDo.value.tasks = toDo.value.tasks.filter((i) => i.id !== id)
}
</script>

<style scoped>
.documents-form {
  max-width: 100%;
}

.documents-form__field {
  display: flex;
  flex-direction: column;
  margin-bottom: 20px;
}

.documents-form__label,
.documents-form__section-label {
  font-size: 12px;
  margin-bottom: 5px;
  color: var(--white-color);
}

.documents-form__input {
  padding: 5px;
  color: var(--black-color);
  border: 1px solid var(--black-color);
  border-radius: 5px;
  box-shadow: var(--box-shadow);
}

.documents-form__actions {
  gap: 20px;
}

.documents-form__button {
  width: 100%;
  margin-bottom: 20px;
}

.documents-form__button--delete {
  margin: 0;
  padding: 6px 11px;
  width: 29.5px;
}

.documents-form__field-row {
  gap: 20px;
}

:disabled {
  cursor: not-allowed;
  background-color: var(--gray-light-color);
  border-color: var(--gray-light-color);
}

:disabled:hover {
  background-color: var(--gray-light-color);
  border-color: var(--gray-light-color);
}
</style>
