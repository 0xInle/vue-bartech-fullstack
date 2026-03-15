import { api } from './api'

export async function registerUser(data: { email: string; password: string }) {
  const res = await api.post('users/register', data)
  return res.data
}
