import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { PrismaClient } from './generated/prisma/index.js'

const app = express()
const prisma = new PrismaClient()

app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log('DATABASE_URL:', process.env.DATABASE_URL)
})

app.get('/ingredients', async (req, res) => {
  try {
    const ingredients = await prisma.ingredient.findMany({
      select: { id: true, name: true },
    })
    res.json(ingredients)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Something went wrong' })
  }
})

app.post('/ingredients', async (req, res) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ error: 'Name is required' })

  try {
    const newIngredient = await prisma.ingredient.create({
      data: { name },
    })
    res.status(201).json(newIngredient)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create ingredient' })
  }
})
