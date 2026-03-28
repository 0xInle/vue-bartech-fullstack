import { Request, Response } from 'express'
import * as userService from './user.service'
import * as repository from './user.repository'
import bcrypt from 'bcrypt'

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
      return res.status(401).json({ error: 'Несанкционированный доступ' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: string
    }

    const user = await repository.findById(decoded.id)

    if (!user) {
      res.clearCookie('token')
      return res.status(401).json({ error: 'Пользователь не найден' })
    }

    res.json(user)
  } catch (error) {
    res.status(401).json({ error: 'Недействительный токен' })
  }
}

export async function loginUser(req: Request, res: Response) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' })
    }

    const user = await repository.findByEmail(email)

    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' })
    }

    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      return res.status(401).json({ error: 'Неверный пароль' })
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET as string, {
      expiresIn: '7d',
    })

    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // true в production (https)
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    })

    res.json({
      id: user.id,
      email: user.email,
    })
  } catch (err: any) {
    res.status(500).json({ error: 'Ошибка сервера при входе' })
  }
}
