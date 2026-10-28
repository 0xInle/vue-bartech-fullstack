import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CLIENT, Prisma, type PrismaClient } from "@bartech/database";

type Database = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class CatalogCategoriesRepository {
  constructor(@Inject(DATABASE_CLIENT) readonly database: PrismaClient) {}

  transaction<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
    return this.database.$transaction(operation);
  }

  lockTree(transaction: Prisma.TransactionClient) {
    return transaction.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_advisory_xact_lock(hashtextextended('ingredient-category-tree', 0)) IS NULL AS locked
    `;
  }

  list(database: Database) {
    return database.ingredientCategory.findMany({
      orderBy: [{ parentCode: "asc" }, { sortOrder: "asc" }, { name: "asc" }, { code: "asc" }],
    });
  }

  findByCode(database: Database, code: string) {
    return database.ingredientCategory.findUnique({ where: { code } });
  }

  create(database: Prisma.TransactionClient, input: Prisma.IngredientCategoryCreateInput) {
    return database.ingredientCategory.create({ data: input });
  }

  update(
    database: Prisma.TransactionClient,
    code: string,
    data: Prisma.IngredientCategoryUpdateInput,
  ) {
    return database.ingredientCategory.update({ where: { code }, data });
  }

  async nextSortOrder(database: Database, parentCode: string | null) {
    const last = await database.ingredientCategory.aggregate({
      where: { parentCode },
      _max: { sortOrder: true },
    });
    return (last._max.sortOrder ?? -1) + 1;
  }
}
