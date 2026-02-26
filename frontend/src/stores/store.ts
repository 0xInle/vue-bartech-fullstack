import { defineStore } from 'pinia'
import type {
  Cocktail,
  IngredientLib,
  Garnish,
  CustomIngredient,
  CustomIngredientLib,
  CustomGarnish,
  CustomGarnishLib,
  ToDoLib,
  ToDo,
  CocktailLib,
} from '@/type/type'
import { ref } from 'vue'

export const useStore = defineStore(
  'store',
  () => {
    const cocktailsLib = ref<CocktailLib>([])
    const ingridientLib = ref<IngredientLib>([])
    const garnishLib = ref<Garnish[]>([])
    const customIngridientLib = ref<CustomIngredientLib>([])
    const customGarnishLib = ref<CustomGarnishLib>([])
    const toDoLib = ref<ToDoLib>([])

    function addCocktail(cocktail: Cocktail) {
      cocktailsLib.value.push(cocktail)
    }

    function delItem<T extends { id: string }>(lib: T[], id: string) {
      const index = lib.findIndex((item) => item.id === id)
      if (index !== -1) {
        lib.splice(index, 1)
      }
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
      cocktailsLib,
      ingridientLib,
      garnishLib,
      customIngridientLib,
      customGarnishLib,
      toDoLib,
      addCocktail,
      delItem,
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
