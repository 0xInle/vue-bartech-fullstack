import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import ingredientRoutes from './modules/ingredient/ingredient.routes.ts'
import userRoutes from './modules/users/user.routes.ts'
import cookieParsel from 'cookie-parser'

const app = express()

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
)
app.use(express.json())
app.use(cookieParsel())

app.use('/ingredients', ingredientRoutes)
app.use('/users', userRoutes)

export default app
