import { Router } from 'express'
import { registerUser, getMe, loginUser } from './user.controller'

const router = Router()

router.post('/register', registerUser)
router.post('/login', loginUser)
router.get('/me', getMe)

export default router
