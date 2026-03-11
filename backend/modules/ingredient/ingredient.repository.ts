import { PrismaClient } from '../../generated/prisma/index.js'

const prisma = new PrismaClient()

export async function findMany(search: string) {
  return prisma.ingredient.findMany({
    where: {
      name: {
        contains: search,
        mode: 'insensitive',
      },
    },
    take: 10,
    select: { id: true, name: true },
  })
}

export async function create(name: string) {
  return prisma.ingredient.create({
    data: { name },
  })
}
