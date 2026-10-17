import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DATABASE_CLIENT, type Prisma, type PrismaClient } from "@bartech/database";

const productExportInclude = {
  ingredient: { include: { category: true } },
  preparation: { include: { category: true } },
  cocktail: { include: { glass: true, ice: true, preparationMethod: true } },
  outputUnit: true,
  parentComponents: {
    orderBy: { position: "asc" },
    include: {
      unit: true,
      componentProduct: { include: { ingredient: { include: { category: true } } } },
    },
  },
  cocktailGarnishes: { orderBy: { position: "asc" }, include: { garnish: true } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductExportReadRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly database: PrismaClient) {}

  async read(companyId: string, venueId: string, productIds?: string[], includeArchived = false) {
    const venue = await this.database.venue.findFirst({
      where: { id: venueId, companyId },
      select: { id: true, companyId: true, name: true },
    });
    if (!venue) throw new NotFoundException("Заведение недоступно");

    const products = await this.database.product.findMany({
      where: {
        venueId,
        ...(productIds ? { id: { in: productIds } } : {}),
        ...(productIds
          ? { status: includeArchived ? { in: ["ACTIVE", "ARCHIVED"] } : "ACTIVE" }
          : {}),
      },
      orderBy: [{ type: "asc" }, { nameNormalized: "asc" }, { id: "asc" }],
      include: productExportInclude,
    });
    if (productIds && products.length !== new Set(productIds).size) {
      throw new NotFoundException("Техкарта недоступна");
    }
    for (const product of products) {
      const invalidUnit = [
        product.outputUnit,
        ...product.parentComponents.map(({ unit }) => unit),
      ].some((unit) => unit && unit.venueId !== null && unit.venueId !== venueId);
      const invalidReference = [
        product.cocktail?.glass,
        product.cocktail?.ice,
        product.cocktail?.preparationMethod,
      ].some(
        (reference) => reference && reference.venueId !== null && reference.venueId !== venueId,
      );
      if (invalidUnit || invalidReference)
        throw new NotFoundException("Связанные данные недоступны");
    }

    const globalIds = [
      ...new Set(
        products.flatMap((product) =>
          product.parentComponents
            .filter((component) => component.componentVenueId === null)
            .map((component) => component.componentProductId),
        ),
      ),
    ];
    const [units, referenceValues, ingredientCategories, preparationCategories, globalIngredients] =
      await Promise.all([
        this.database.unit.findMany({ where: { OR: [{ venueId: null }, { venueId }] } }),
        this.database.referenceValue.findMany({
          where: { OR: [{ venueId: null }, { venueId }] },
        }),
        this.database.ingredientCategory.findMany(),
        this.database.preparationCategory.findMany(),
        this.database.product.findMany({
          where: { id: { in: globalIds }, venueId: null, type: "INGREDIENT" },
          include: productExportInclude,
          orderBy: { id: "asc" },
        }),
      ]);
    return {
      venue,
      products,
      units,
      referenceValues,
      ingredientCategories,
      preparationCategories,
      globalIngredients,
    };
  }
}
