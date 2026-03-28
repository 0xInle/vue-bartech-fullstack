import bcrypt from 'bcrypt'
import * as repository from './user.repository'
import { generateToken } from '../utils/generateToken'

export async function registerUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase()

  const existingUser = await repository.findByEmail(normalizedEmail)

  if (existingUser) {
    throw new Error('Пользователь уже существует')
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await repository.create(normalizedEmail, hashedPassword)

  const token = generateToken(user.id)

  return {
    user,
    token,
  }
}
