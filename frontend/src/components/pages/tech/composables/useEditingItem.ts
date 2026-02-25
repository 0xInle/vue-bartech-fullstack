import { ref, reactive, toRaw } from 'vue'
import type { Coctail, CustomIngredient, CustomGarnish } from '@/type/type'

export function useEditingItem() {
  const editingCocktail = ref<Coctail | null>(null)
  const editingIngredient = ref<CustomIngredient | null>(null)
  const editingGarnish = ref<CustomGarnish | null>(null)

  function editCocktail(cocktail: Coctail) {
    editingCocktail.value = reactive(toRaw(cocktail))
  }

  function editIngredient(ingredient: CustomIngredient) {
    editingIngredient.value = reactive(toRaw(ingredient))
  }

  function editGarnish(garnish: CustomGarnish) {
    editingGarnish.value = reactive(toRaw(garnish))
  }

  return {
    editingCocktail,
    editingIngredient,
    editingGarnish,
    editGarnish,
    editIngredient,
    editCocktail,
  }
}
