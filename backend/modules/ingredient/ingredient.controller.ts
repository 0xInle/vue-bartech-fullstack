import { Request, Response } from 'express'
import * as ingredientService from './ingredient.service.js'

export async function getIngredients(req: Request, res: Response) {
  try {
    const search = String(req.query.search || '')

    const ingredients = await ingredientService.searchIngredients(search)

    res.json(ingredients)
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' })
  }
}

export async function createIngredient(req: Request, res: Response) {
  try {
    const { name } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Name is required' })
    }

    const ingredient = await ingredientService.createIngredient(name)

    res.status(201).json(ingredient)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create ingredient' })
  }
}
