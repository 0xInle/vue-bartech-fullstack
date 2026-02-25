import { defineStore } from 'pinia'
import type {
  Coctail,
  IngredientLib,
  Garnish,
  CustomIngredient,
  CustomIngredientLib,
  CustomGarnish,
  CustomGarnishLib,
  toDoLib,
  ToDo,
} from '@/type/type'
import { ref } from 'vue'

export const useStore = defineStore(
  'store',
  () => {
    const coctailsLib = ref<Coctail[]>([])
    const ingridientLib = ref<IngredientLib>([])
    const garnishLib = ref<Garnish[]>([])
    const customIngridientLib = ref<CustomIngredientLib>([])
    const customGarnishLib = ref<CustomGarnishLib>([])
    const toDoLib = ref<toDoLib>([])

    function addCocktail(cocktail: Coctail) {
      coctailsLib.value.push(cocktail)
    }

    function addCustomIngridient(customIngridient: CustomIngredient) {
      customIngridientLib.value.push(customIngridient)
    }

    function addCustomGarnish(customGarnish: CustomGarnish) {
      customGarnishLib.value.push(customGarnish)
    }

    function addToDo(toDo: ToDo) {
      toDoLib.value.push(toDo)
    }

    function delToDo(id: string) {
      toDoLib.value = toDoLib.value.filter((i) => i.id !== id)
    }

    function updateToDoTask(task: ToDo) {
      const index = toDoLib.value.findIndex((i) => i.id === task.id)
      if (index !== -1) {
        toDoLib.value[index] = task
      }
    }

    return {
      coctailsLib,
      ingridientLib,
      garnishLib,
      customIngridientLib,
      customGarnishLib,
      toDoLib,
      addCocktail,
      addCustomIngridient,
      addCustomGarnish,
      addToDo,
      delToDo,
      updateToDoTask,
    }
  },
  {
    persist: true,
  },
)
