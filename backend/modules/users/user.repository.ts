import prisma from '../../lib/db.js'

export async function findByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  })
}

export async function findById(id: string) {
  return prisma.user.findUnique({
    where: { id },
  })
}

export async function create(email: string, password: string) {
  return prisma.user.create({
    data: {
      email,
      password,
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  })
}
