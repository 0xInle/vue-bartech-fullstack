import * as repository from './ingredient.repository.js'

export async function searchIngredients(search: string) {
  return repository.findMany(search)
}

export async function createIngredient(name: string) {
  const normalizedName = name.trim().toLowerCase()

  if (!normalizedName) {
    throw new Error('Name is required')
  }

  return repository.create(normalizedName)
}
