import { PrismaClient } from '../generated/prisma/index.js'
import { ingredients } from './ingredients-list.js'

const prisma = new PrismaClient()

async function main() {
  await prisma.ingredient.createMany({
    data: ingredients.map((name) => ({ name })),
    skipDuplicates: true,
  })

  console.log('Seed completed')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
