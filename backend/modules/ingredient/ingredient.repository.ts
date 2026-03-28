import prisma from '../../lib/db.js'

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
