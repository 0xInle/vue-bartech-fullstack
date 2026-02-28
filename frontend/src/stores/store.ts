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
    const ingredientLib = ref<IngredientLib>([])
    const garnishLib = ref<Garnish[]>([])
    const customIngredientLib = ref<CustomIngredientLib>([])
    const customGarnishLib = ref<CustomGarnishLib>([])
    const toDoLib = ref<ToDoLib>([])

    function addCocktail(cocktail: Cocktail) {
      cocktailsLib.value.push(cocktail)
    }

    function removeItemById<T extends { id: string }>(collection: T[], id: string) {
      const index = collection.findIndex((item) => item.id === id)
      if (index !== -1) {
        collection.splice(index, 1)
      }
    }

    function addCustomIngredient(customIngredient: CustomIngredient) {
      customIngredientLib.value.push(customIngredient)
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
      ingredientLib,
      garnishLib,
      customIngredientLib,
      customGarnishLib,
      toDoLib,
      addCocktail,
      removeItemById,
      addCustomIngredient,
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
