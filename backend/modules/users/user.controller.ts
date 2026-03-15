import { Request, Response } from 'express'
import * as userService from './user.service'
import * as repository from './user.repository'

import jwt from 'jsonwebtoken'

export async function registerUser(req: Request, res: Response) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const { user, token } = await userService.registerUser(email, password)

    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // true в production (https)
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    })

    res.status(201).json(user)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    const token = req.cookies.token

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string
    }

    const user = await repository.findById(decoded.id)

    if (!user) {
      res.clearCookie('token')
      return res.status(401).json({ error: 'User not found' })
    }

    res.json(user)
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' })
  }
}
