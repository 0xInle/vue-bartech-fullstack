import { Router } from 'express'
import { getIngredients, createIngredient } from './ingredient.controller.js'

const router = Router()

router.get('/', getIngredients)
router.post('/', createIngredient)

export default router
