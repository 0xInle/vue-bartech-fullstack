import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import ingredientRoutes from './modules/ingredient/ingredient.routes.ts'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/ingredients', ingredientRoutes)

export default app
