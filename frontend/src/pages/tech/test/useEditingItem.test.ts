import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { useEditingItem } from '../composables/useEditingItem'
import type { Cocktail, CustomGarnish, CustomIngredient } from '@/type/type'

describe('useEditingItem', () => {
  function setup() {
    let composable: ReturnType<typeof useEditingItem>

    mount({
      template: '<div></div>',
      setup() {
        composable = useEditingItem()
        return {}
      },
    })

    return composable!
  }

  it('инициализируется с null', () => {
    const composable = setup()

    expect(composable.editingCocktail.value).toBeNull()
    expect(composable.editingIngredient.value).toBeNull()
    expect(composable.editingGarnish.value).toBeNull()
  })

  it('устанавливает cocktail через editCocktail', () => {
    const composable = setup()
    const coctail: Cocktail = {
      id: '1',
      name: 'Sazerak',
      ingredients: [
        {
          id: '1',
          name: 'Sugar',
          amount: 42,
          unit: 'string',
        },
      ],
      params: { glass: 'Рокс', ice: 'Фрапе', method: 'Билд' },
      comment: 'test',
      garnish: 'test',
    }

    composable.editCocktail(coctail)
    composable.editingCocktail.value!.name = 'Negroni'

    expect(composable.editingCocktail.value!.name).toBe('Negroni')
    expect(composable.editingCocktail.value).toEqual(coctail)
  })

  it('устанавливает ingredient через editingIngredient', () => {
    const composable = setup()
    const ingredient: CustomIngredient = {
      id: '1',
      name: 'Syrup',
      ingredients: [],
      comment: 'test',
    }

    composable.editIngredient(ingredient)
    composable.editingIngredient.value!.name = 'Lime Syrup'

    expect(composable.editingIngredient.value!.name).toBe('Lime Syrup')
    expect(composable.editingIngredient.value).toEqual(ingredient)
  })

  it('устанавливает garnish через editingGarnish', () => {
    const composable = setup()
    const garnish: CustomGarnish = {
      id: '1',
      name: 'Chips',
      ingredients: [],
      comment: 'test',
    }

    composable.editGarnish(garnish)
    composable.editingGarnish.value!.name = 'Orange'

    expect(composable.editingGarnish.value!.name).toBe('Orange')
    expect(composable.editingGarnish.value).toEqual(garnish)
  })
})
