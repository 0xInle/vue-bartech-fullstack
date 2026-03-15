import { Router } from 'express'
import { registerUser, getMe } from './user.controller'

const router = Router()

router.post('/register', registerUser)
router.get('/me', getMe)

export default router
